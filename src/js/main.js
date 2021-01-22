import $ from "jquery"
import GoldenLayout from "golden-layout"
import * as monaco from "monaco-editor/esm/vs/editor/editor.api"
import * as alogicSyntax from "./alogic_syntax.js"
import lzstring from "lz-string"
import Clipboard from "clipboard"
import tippy from "tippy.js"

/* global VERSION */

function indexPage() {

  // The default example content
  const defaultConfig = {
    args: "-o out top.alogic",
    inputFiles : {
      "top.alogic": [
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
      ].join("\n")
    }
  }

  // Grab hadles to static components
  const cliArgs = $("#cliArgs")
  const shareButton = $("#shareButton")

  // File name predicate function
  function isVerilog(name) {
    return name.endsWith(".v") || name.endsWith(".sv")
  }

  // Make a golden-layout component config for an input file
  function makeInputTab(name, contents, showNameEditor=false) {
    return {
      type: "component",
      id: "inputArea",
      componentName: "inputArea",
      title: name,
      componentState: {
        text: contents,
        showNameEditor: showNameEditor
      }
    }
  }

  // Make a golden-layout component config for an output file
  function makeOutputTab(name, contents) {
    const language = isVerilog(name)        ? "systemverilog" :
                     name.endsWith(".json") ? "json"          :
                                              "plaintext"
    return {
      type: "component",
      id: "outputArea",
      componentName: "outputArea",
      title: name,
      componentState: {
        text : contents,
        language : language
      }
    }
  }

  // Initial golden-layout configuration
  const initialLayoutConfig = {
    content: [{
      type: "column",
      content: [{
        type: "row",
        height: 5,
        content: [{
          type: "stack",
          id: "inputStack",
          isClosable: false,
          content: [
            // No initial input file, will be set by restoreConfigFromBrowserState
          ]
        }, {
          type: "stack",
          id: "outputStack",
          isClosable: false,
          content: [
            makeOutputTab("Output", "") // Placeholder prior to compilation
          ]
        }],
      }, {
        type: "component",
        componentName: "consoleArea",
        title: "Console",
        isClosable: false,
        height: 2
      }]
    }]
  }

  // Create the golden-layout instance
  const root = $(".maincontent")
  root.css({ overflow: "hidden" }) // ensures layout can shrink with window, not just expand
  const goldenLayout = new GoldenLayout(initialLayoutConfig, root)

  // Resize layout to fit visible space
  window.addEventListener("resize", function () { goldenLayout.updateSize() })

  // Convenience accessors
  function getInputStack() { return goldenLayout.root.getItemsById("inputStack")[0] }
  function getInputItems() { return goldenLayout.root.getItemsById("inputArea") }
  function getOutputStack() { return goldenLayout.root.getItemsById("outputStack")[0] }
  function getOutputItems() { return goldenLayout.root.getItemsById("outputArea") }

  // Get config object based on UI content
  function getConfig() {
    const config = {
      args : cliArgs.val().trim(),
      inputFiles: {}
    }
    getInputItems().forEach(function (item) {
      config.inputFiles[item.config.title] = item.container.editor.getValue()
    })
    return config
  }

  // Restore UI content based on config object
  function restoreConfig(config) {
    // Restore arguments
    cliArgs.val(config.args);
    // Sort input files by name, "top.alogic" first
    const names = Object.keys(config.inputFiles).sort(function (a, b) {
      const aIsTop = a == "top.alogic"
      const bIsTop = b == "top.alogic"
      if (aIsTop && !bIsTop) {
        return -1
      } else if (!aIsTop && bIsTop) {
        return 1
      } else {
        return a.localeCompare(b)
      }
    })
    // Remove all current input files
    for (;;) {
      const inputItems = getInputItems()
      if (inputItems.length == 0) break
      inputItems[0].remove()
    }
    // Get input stack
    const inputStack = getInputStack()
    // Restore input files from config
    names.forEach( name =>
      inputStack.addChild(makeInputTab(name, config.inputFiles[name]))
    )
    // Select the first input tab (if there are any)
    if (names.length > 0) {
      inputStack.setActiveContentItem(inputStack.contentItems[0])
    }
  }

  // Restore from URL fragment or localStorage
  function restoreConfigFromBrowserState() {
    // Figure out what to restore
    let config = defaultConfig
    if (window.location.hash == "#@default") {
      // Restore default content
    } else if (window.location.hash != "") {
      config = JSON.parse(lzstring.decompressFromBase64(window.location.hash.slice(1)))
    } else if (window.localStorage.getItem("config") !== null) {
      config = JSON.parse(lzstring.decompressFromUTF16(window.localStorage.getItem("config")))
    }

    // Clear URL fragment identifier to keep it neat
    window.location.hash = ""

    // Restore it
    restoreConfig(config)
  }

  // Save current UI state in localStorage
  function storeConfigInLocalStorage(config) {
    window.localStorage.setItem("config", lzstring.compressToUTF16(JSON.stringify(config)))
  }

  // Restore config when the layout has been initialized
  goldenLayout.on("initialised", restoreConfigFromBrowserState)

  // Restore config when the URL fragment identifier changes, unless it becomes
  // empty. Note restoreConfigFromBrowserState itself clears the URL fragment
  // identifier.
  window.onhashchange = function () {
    if (window.location.hash !== "") {
      restoreConfigFromBrowserState()
    }
  }

  // Save state in localStorage when leaving the page
  window.onbeforeunload = function () {
    storeConfigInLocalStorage(getConfig())
  }

  // Teach Monaco about the Alogic language
  monaco.languages.register({ id: "alogic" })
  monaco.languages.setMonarchTokensProvider("alogic", alogicSyntax.monarchDefinition)

  // Register with goldenLayout how to create an inputArea
  goldenLayout.registerComponent("inputArea", function (container, state) {
    container.editor = monaco.editor.create(container.getElement()[0], {
      value: state.text,
      language: "alogic",
      automaticLayout: true,
      lineNumbersMinChars: 3,
      wordWrap: false,
      rulers: [80]
    })

    // Add name input box when tab is created
    container.on("tab", function (tab) {
      const inputBox = $("<input type=\"text\">")
      const instance = tippy(tab.element[0], {
        content: inputBox[0],
        trigger: "manual",
        placement: "bottom-start",
        interactive: true,
        theme: "light-border",
        duration: 0,
        onShown() {
          // Set initial contents of input box
          const value = tab.contentItem.config.title
          inputBox.val(value)
          // Select basename
          inputBox[0].setSelectionRange(0, value.indexOf("."))
          // Set focus on input box
          inputBox.focus()
        },
        onHidden() {
          // Set title to input box contents, unless there is already an
          // input box with the same title
          const name = inputBox.val().trim()
          if (getInputItems().every(item => item.config.title != name)) {
            tab.contentItem.setTitle(name)
          }
        },
        onCreate(instance) {
          // Show when created if requested (note: showOnCreate does not work,
          // probably because we need the deferment via setTimeout)
          if (state.showNameEditor) {
            window.setTimeout(function () { instance.show() }, 0)
          }
        }
      })
      // Close editor popover on pressing Enter
      inputBox.keypress(function (event) {
        if (event.keyCode == 13) {
          instance.hide()
        }
      })
      // Show editor on double clicking tab (this works better than using
      // trigger: "dblclick" with the tippy instance)
      tab.element.dblclick(function () {
        instance.show()
      })
    })
  })

  // Register with goldenLayout how to create an outputArea
  goldenLayout.registerComponent("outputArea", function (container, state) {
    monaco.editor.create(container.getElement()[0], {
      value: state.text,
      language: state.language,
      automaticLayout: true,
      lineNumbersMinChars: 3,
      wordWrap: false,
      readOnly: true,
      rulers: [80]
    })
  })

  // Register with goldenLayout how to create a consoleArea
  goldenLayout.registerComponent("consoleArea", function (container, ) {
    window.consoleEditor = monaco.editor.create(container.getElement()[0], {
      language: "plaintext",
      automaticLayout: true,
      lineNumbers: false,
      wordWrap: false,
      readOnly: true,
      renderIndentGuides: false
    })
  })

  // Add new input file button
  $("#newInputTab").click(function () {
    const inputItems = getInputItems();
    let n = 0
    while (inputItems.some(item => item.config.title == "input"+n+".alogic")) {
      n += 1
    }
    const name = "input"+n+".alogic"
    getInputStack().addChild(makeInputTab(name, "", true))
  })

  // Turn on UI busy overlay
  function busyOverlayOn(text) {
    $("#busyText").html(text);
    $("div.busySpanner").addClass("show");
    $("div.busyOverlay").addClass("show");
  }

  // Turn off UI busy overlay
  function busyOverlayOff() {
    $("div.busySpanner").removeClass("show");
    $("div.busyOverlay").removeClass("show");
  }

  // Send a request to the compiler back-end
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

        // Call user callback
        onError(error)
      }
    })
  }

  // Compile button click
  $("#compileButton").click(function () {
    // Show overlay busy indicator
    busyOverlayOn("Compiling Alogic")

    // Build request based on the UI configuration
    const config = getConfig()
    const request = {
      request: "compile",
      ...config
    }

    // Clear editor markers
    getInputItems().forEach(function (item) {
      monaco.editor.setModelMarkers(
        item.container.editor.getModel(),
        "alogic",
        []
      )
    })

    // Remove all current output tabs
    for (;;) {
      const outputItems = getOutputItems()
      if (outputItems.length == 0) break
      outputItems[0].remove()
    }

    // Clear console
    window.consoleEditor.setValue("")

    // Perform compilation
    compilerRequest(
      request,
      // On request success
      function (data) {
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
        }).join("\n")
        window.consoleEditor.setValue(messages)
        window.consoleEditor.revealLine(1)

        // Annotate editor with message markers
        const contents = {}
        const models = {}
        const markers = {}
        getInputItems().forEach(function (item) {
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
            let severity = monaco.MarkerSeverity.Error
            if (message.category == "WARNING") {
              severity = monaco.MarkerSeverity.Warning
            } else if (message.category == "NOTE") {
              severity = monaco.MarkerSeverity.Info
            }
            markers[message.file].push({
              startLineNumber: startLineNumber,
              startColumn: startColumn,
              endLineNumber: endLineNumber,
              endColumn: endColumn,
              severity: severity,
              message: message.lines.join("\n ... ")
            })
          }
        })
        for (const file in markers) {
          monaco.editor.setModelMarkers(models[file], "alogic", markers[file])
        }

        // Find the top level ouput files based on the manifest
        let topOutputFiles = []
        if (data.code == "ok") {
          const manifestName = Object.keys(data.outputFiles).find(name => name.endsWith("manifest.json"))
          const manifest = JSON.parse(data.outputFiles[manifestName])
          topOutputFiles = Object.values(manifest["top-levels"]).map(item => item["output-file"])
        }

        // Sort output files by name, Top levels first, then Verilog, then rest
        const names = Object.keys(data.outputFiles).sort(function (a, b) {
          const aIsTop = topOutputFiles.indexOf(a) >= 0
          const bIsTop = topOutputFiles.indexOf(b) >= 0
          const aIsVerilog = isVerilog(a)
          const bIsVerilog = isVerilog(b)
          if (aIsTop && !bIsTop) {
            return -1
          } else if (!aIsTop && bIsTop) {
            return 1
          } else if (aIsVerilog && !bIsVerilog) {
            return -1
          } else if (!aIsVerilog && bIsVerilog) {
            return 1
          } else {
            return a.localeCompare(b)
          }
        });

        // Get outputStack
        const outputStack = getOutputStack()

        // Create new tabs holding the output files
        names.forEach(function (name) {
          outputStack.addChild(makeOutputTab(name, data.outputFiles[name]))
        })

        // Select the first output tab (if there are any)
        if (names.length > 0) {
          outputStack.setActiveContentItem(outputStack.contentItems[0])
        }

        // Turn off overlay
        busyOverlayOff()
      },
      // On request error
      function () {
        // Turn off overlay
        busyOverlayOff()
      }
    )
  })

  // Initialize clipboard.js
  new Clipboard($("#sharePopover button")[0])

  // Add the popover to the share button
  const sharePopover = document.getElementById('sharePopover')
  sharePopover.style.display = 'block';
  tippy("#shareButton", {
    content: sharePopover,
    trigger: "click",
    placement: "bottom-end",
    interactive: true,
    theme: "light-border"
  })

  // Share button click
  shareButton.click(function () {
    const shareLink = $("#sharePopover input")
    // Clear the value
    shareLink.val(null)
    // Compress the config
    const base64config = lzstring.compressToBase64(JSON.stringify(getConfig()))
    // Form link
    const link = window.location.origin + window.location.pathname + "#" + base64config
    // Set link value
    shareLink.val(link)
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

  // Show goldenLayout
  goldenLayout.init()
}


// Run only on the index page
if ($("#indexPage").length > 0) {
  indexPage()
}

