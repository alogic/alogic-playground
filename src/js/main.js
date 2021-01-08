import $ from "jquery";
import GoldenLayout from "golden-layout";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import * as alogicSyntax from "./alogic_syntax.js";

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

const root = $("#root");
const myLayout = new GoldenLayout(config, root);

function sizeRoot () {
  const height = $(window).height() - root.position().top - $(".footer").outerHeight();
  root.height(height);
  myLayout.updateSize();
}

$(window).resize(sizeRoot);
sizeRoot();

monaco.languages.register({ id: "alogic" });

monaco.languages.setMonarchTokensProvider("alogic", alogicSyntax.monarchDefinition)

myLayout.registerComponent("inputArea", function (container, ) {
  container.editor = monaco.editor.create(container.getElement()[0], {
    value: "network example {\n  in bool i;\n  out bool o;\n  i -> o;\n}",
    language: "alogic",
    automaticLayout: true,
    wordWrap: true
  });
});

myLayout.registerComponent("outputArea", function (container, state) {
  monaco.editor.create(container.getElement()[0], {
    value: state.text,
    language: state.language,
    automaticLayout: true,
    wordWrap: true,
    readOnly: true
  });
});

myLayout.registerComponent("consoleArea", function (container, ) {
  window.consoleEditor = monaco.editor.create(container.getElement()[0], {
    language: "plaintext",
    automaticLayout: true,
    wordWrap: true,
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

compileButton.click(function () {
  // Disable compile button while we are compiling
  compileButton.prop("disabled", true);

  // Gather input files
  const inputStack = myLayout.root.getItemsById("inputStack")[0];
  const files = {};
  inputStack.contentItems.forEach(item =>
    files[item.config.title] = item.container.editor.getValue()
  );

  // Create compiler request
  const request = {
    request: "compile",
    args : cliArgs.val().split(/[ ]+/),
    files : files
  }

  // Send it off
  $.ajax({
    type: "POST",
    //url: "http://localhost:8080",
    url: "https://us-central1-ccx-eng-cam.cloudfunctions.net/alogic-playground",
    data: JSON.stringify(request),
    datatype: "json",
    contentType: "application/json; charset=utf-8",
    success: function (data) {
      //console.log(request);
      //console.log(data);
      // Emit messages to the console
      const messages = data.messages.map(_ => _.text).join("\n");
      window.consoleEditor.setValue(messages);

      // Remove all current output tabs
      const outputStack = myLayout.root.getItemsById("outputStack")[0];
      while (outputStack.contentItems.length > 0) {
        outputStack.removeChild(outputStack.contentItems[0]);
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

      // Re-enable compile button
      $("#compileButton").prop("disabled", false);
    },
    error: function (error) {
      console.log(request);
      console.log(error);
      $("#compileButton").prop("disabled", false);
    }
  })
})

myLayout.init();
