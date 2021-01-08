// *****************************************************************************
// Argon Design Ltd. Project P8009 Alogic
// (c) Copyright 2017 Argon Design Ltd. All rights reserved.
//
// Module : afiddle
// Author : Steve Barlow
// $Id:$
//
// DESCRIPTION:
// Alogic language syntax definition for Monaco code highlighting editor.
// *****************************************************************************

// Useful websites:
// https://microsoft.github.io/monaco-editor/monarch.html
// https://github.com/ArgonDesign/alogic/blob/master/src/main/antlr4/VLexer.g4

// !!! Tried to use nextEmbedded: 'verilog' to correctly syntax colour embedded
// Verilog which works in basic form, but couldn't get it to retain Verilog mode
// after a nested closing brace. So changed to highlight Verilog with a fixed
// colour instead.

// Tell Standard about globals so it doesn't give lint errors
/* global define */

define({

  monarchDefinition: {
    // Set defaultToken to invalid to see what you do not tokenize yet
    // defaultToken: 'invalid',

    keywords: [
      'fsm', 'network', 'pipeline', 'typedef', 'struct', 'in', 'out', 'const',
      'param', 'fence', 'true', 'false', 'loop', 'while', 'do', 'for', 'if',
      'goto', 'else', 'break', 'continue', 'return', 'case', 'default', 'new',
      'let', 'entity', 'static', 'stall', 'comb', 'stack', 'sram', 'reg',
      'signed', 'unsigned', 'gen', 'type', 'assert', 'sync', 'ready', 'accept',
      'wire', 'bubble', 'fslice', 'bslice', 'verbatim', 'verilog'
    ],

    typeKeywords: [
      'void', 'bool', 'uint', 'int'
    ],

    builtinFunctionKeywords: [
      '$clog2', '$signed', '$unsigned', '@bits', '@msb', '@ex', '@zx', '@sx'
    ],

    operators: [
      '->', '*', '/', '%', '+', '-', '~', '&', '~&', '|', '~|', '^', '~^',
      '<<', '>>', '>>>', '<<<', '!', '&&', '||', '==', '!=', '>', '>=', '<=',
      '<', '?', '++', '--', '=', '*=', '/=', '%=', '+=', '-=', '&=', '|=',
      '^=', '>>=', '<<=', '>>>=', '<<<='
    ],

    // define our own brackets as '<' and '>' do not match in Alogic
    brackets: [
      ['(', ')', 'bracket.parenthesis'],
      ['{', '}', 'bracket.curly'],
      ['[', ']', 'bracket.square']
    ],

    // we include these common regular expressions
    symbols: /[=><!~?:&|+\-*/^%]+/,

    // C style strings
    escapes: /\\(?:[abfnrtv\\"'?]|[0-7]{1,3}|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    // The main tokenizer for Alogic
    tokenizer: {
      root: [
        // embedded Verilog
        [/(verilog)(\s*)(\{)/, [
          'keyword',
          'white',
          { token: '@brackets', next: '@verilog' }]
        ],

        // keywords and identifiers
        [/[A-Za-z_$@][A-Za-z0-9_$@]*/, {
          cases: {
            '[ui]\\d+': 'type', // Shorthand u8 etc.
            '@typeKeywords': 'type',
            '@keywords': 'keyword',
            '@builtinFunctionKeywords': 'keyword',
            '@default': 'identifier'
          }
        }],

        // whitespace
        { include: '@whitespace' },

        // delimiters and operators
        [/[{}()[\]]/, '@brackets'],
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }],

        // numbers
        [/[0-9]*'s?[bdh][0-9a-fA-F_]+/, 'number'],
        [/[0-9][0-9_]*/, 'number'],

        // delimiter: after number because of .\d floats
        [/[;,.]/, 'delimiter'],

        // strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-teminated string
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }]

      ],

      // Embedded Verilog is coloured as a constant
      verilog: [
        [/[^{}]+/, 'constant'],
        [/\{/, { token: 'constant', next: '@verilog2' }],
        [/\}/, { token: 'bracket', bracket: '@close', next: '@pop' }]
      ],
      verilog2: [
        [/[^{}]+/, 'constant'],
        [/\{/, { token: 'constant', next: '@verilog2' }],
        [/\}/, { token: 'constant', next: '@pop' }]
      ],

      comment: [
        [/[^/*]+/, 'comment'],
        [/\/\*/, 'comment', '@push'], // nested comment
        ['\\*/', 'comment', '@pop'],
        [/[/*]/, 'comment']
      ],

      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
      ],

      whitespace: [
        [/[ \t\r\n]+/, 'white'],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment']
      ]
    }

  } // monarchDefinition

})
