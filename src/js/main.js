import $ from "jquery";
import GoldenLayout from "golden-layout";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import * as alogicSyntax from "./alogic_syntax.js";

/* global VERSION */

const config = {
  content: [{
    type: "column",
    content: [{
      type: "row",
      height: 5,
      content: [{
        type: "stack",
        id: "inputStack",
        isClosable: false,
        content:[{
          type: "component",
          componentName: "inputArea",
          title: "top.alogic"
        }]
      }, {
        type: "stack",
        id: "outputStack",
        isClosable: false,
        content: [{
          type: "component",
          componentName: "outputArea",
          componentState: {
            text: "",
            language: "plaintext"
          },
          title: "Output"
        }]
      }],
    }, {
      type: "component",
      componentName: "consoleArea",
      title: "Console",
      isClosable: false,
      height: 2
    }]
  }]
};

const root = $(".maincontent");
const myLayout = new GoldenLayout(config, root);

// Resize layout to fit visible space
root.css({ overflow: "hidden" });
window.addEventListener("resize", function () { myLayout.updateSize() });

monaco.languages.register({ id: "alogic" });

monaco.languages.setMonarchTokensProvider("alogic", alogicSyntax.monarchDefinition)

myLayout.registerComponent("inputArea", function (container, ) {
  container.editor = monaco.editor.create(container.getElement()[0], {
    value: [
      "fsm example {",
      "  in  u8 a;",
      "  in  u8 b;",
      "  out u8 s;",
      "",
      "  void main() {",
      "    s = a + b;",
      "    fence;",
      "  }",
      "}"
    ].join("\n"),
    language: "alogic",
    automaticLayout: true,
    lineNumbersMinChars: 3,
    wordWrap: false,
    rulers: [80]
  });
});

myLayout.registerComponent("outputArea", function (container, state) {
  monaco.editor.create(container.getElement()[0], {
    value: state.text,
    language: state.language,
    automaticLayout: true,
    lineNumbersMinChars: 3,
    wordWrap: false,
    readOnly: true,
    rulers: [80]
  });
});

myLayout.registerComponent("consoleArea", function (container, ) {
  window.consoleEditor = monaco.editor.create(container.getElement()[0], {
    language: "plaintext",
    automaticLayout: true,
    lineNumbers: false,
    wordWrap: false,
    readOnly: true,
    renderIndentGuides: false
  });
});

const compileButton = $("#compileButton");
const cliArgs = $("#cliArgs");
cliArgs.val("-o out top.alogic");

function isVerilog(name) {
  return name.endsWith(".v") || name.endsWith(".sv");
}

function busyOverlayOn(text) {
  $("#busyText").html(text);
  $("div.busySpanner").addClass("show");
  $("div.busyOverlay").addClass("show");
}

function busyOverlayOff() {
  $("div.busySpanner").removeClass("show");
  $("div.busyOverlay").removeClass("show");
}

function compilerRequest(request, onSuccess, onError = null) {
  $.ajax({
    type: "POST",
    //url: "http://localhost:8080",
    url: "https://us-central1-ccx-eng-cam.cloudfunctions.net/alogic-playground",
    data: JSON.stringify(request),
    datatype: "json",
    contentType: "application/json; charset=utf-8",
    success: onSuccess,
    error: function (error) {
      // Log request and response on error
      console.log(request)
      console.log(error)

      // Turn off overlay
      onError(error)
    }
  })
}

function messageSeverity(message) {
  if (message.category == "WARNING") {
    return monaco.MarkerSeverity.Warning
  } else if (message.category == "NOTE") {
    return monaco.MarkerSeverity.Info
  } else {
    return monaco.MarkerSeverity.Error
  }
}

compileButton.click(function () {
  // Show overlay busy indicator
  busyOverlayOn("Compiling Alogic")

  // Gather input files and clear markers while we are at it
  const inputStack = myLayout.root.getItemsById("inputStack")[0];
  const files = {};
  inputStack.contentItems.forEach(function (item) {
    const editor = item.container.editor
    // Clear markers
    monaco.editor.setModelMarkers(editor.getModel(), "alogic", []);
    // Grab contents
    files[item.config.title] = item.container.editor.getValue()
  })

  // Remove all current output tabs
  const outputStack = myLayout.root.getItemsById("outputStack")[0];
  while (outputStack.contentItems.length > 0) {
    outputStack.removeChild(outputStack.contentItems[0]);
  }

  // Clear console
  window.consoleEditor.setValue("")

  // Perform compilation
  compilerRequest(
    {
      request: "compile",
      args : cliArgs.val().trim().split(/[ ]+/),
      files : files
    },
    function (data) {
      //console.log(request);
      //console.log(data);

      // Emit messages to the console
      const messages = data.messages.map(function (message) {
        // Render message the same way as the compiler
        let prefix = ""
        if (message.file != "") {
          prefix = message.file + ":" + message.line + ": "
        }
        if (!message.category.startsWith("STD")) {
          prefix = prefix + message.category + ": "
        }
        let buf = ""
        if (message.lines.length > 0) {
          buf += prefix + message.lines[0] + "\n"
          message.lines.slice(1).forEach( line =>
            buf += prefix + "... " + line + "\n"
          )
        }
        return buf + message.context
      }).join("\n");
      window.consoleEditor.setValue(messages);
      window.consoleEditor.revealLine(1);

      // Annotate editor with message markers
      const contents = {}
      const models = {}
      const markers = {}
      inputStack.contentItems.forEach(function (item) {
        const file = item.config.title
        const editor = item.container.editor
        contents[file] = editor.getValue()
        models[file] = editor.getModel()
        markers[file] = []
      })
      data.messages.forEach(function (message) {
        if (message.file != "") {
          // Turn string offsets into start/end line/col
          const startLineNumber = message.line
          const c = contents[message.file]
          let x  = message.start
          while (x > 1 && c[x-1] !== "\n") { x -= 1 }
          const startColumn = message.start - x + 1 // Monaco is 1 based
          x = message.start
          let endLineNumber = startLineNumber
          let endColumn = startColumn
          while (x < message.end) {
            endColumn += 1
            if (c[x] == "\n") {
              endColumn = 1
              endLineNumber += 1
            }
            x += 1
          }
          markers[message.file].push({
            startLineNumber: startLineNumber,
            startColumn: startColumn,
            endLineNumber: endLineNumber,
            endColumn: endColumn,
            severity: messageSeverity(message),
            message: message.lines.join("\n ... ")
          })
        }
      })
      for (const file in markers) {
        monaco.editor.setModelMarkers(models[file], "alogic", markers[file])
      }

      // Sort output files by name, Verilog first
      const names = Object.keys(data.files).sort(function (a, b) {
        const aIsVerilog = isVerilog(a);
        const bIsVerilog = isVerilog(b);
        if (aIsVerilog && !bIsVerilog) {
          return -1;
        } else if (!aIsVerilog && bIsVerilog) {
          return 1;
        } else {
          return a.localeCompare(b);
        }
      });

      // Create new tabs holding the output files
      names.forEach(function (name) {
        const newConfig = {
          type: "component",
          title: name,
          componentName: "outputArea",
          componentState: {
            text : data.files[name],
            language : isVerilog(name)        ? "systemverilog" :
                       name.endsWith(".json") ? "json" :
                                                "plaintext"
          }
        }
        outputStack.addChild(newConfig);
      });

      // Select the first output tab (if there are any)
      if (names.length > 0) {
        outputStack.setActiveContentItem(outputStack.contentItems[0]);
      }

      // Turn off overlay
      busyOverlayOff();
    },
    function () {
      // Turn off overlay
      busyOverlayOff();
    }
  )
})

// Display Playground version
$("#playgroundVersion").html(VERSION)

// Fetch and display compiler version
compilerRequest(
  {
    request : "describe"
  },
  function (data) {
    $("#compilerVersion").html(data.compilerVersion)
  },
  function () {
    $("#compilerVersion").html("UNKNOWN")
  }
)

myLayout.init();
