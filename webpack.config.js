const webpack = require("webpack");
const ESLintPlugin = require("eslint-webpack-plugin");
const StylelintPlugin = require("stylelint-webpack-plugin");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
const GitRevisionPlugin = require("git-revision-webpack-plugin");

const gitRevisionPlugin = new GitRevisionPlugin(versionCommand="describe --always");

module.exports = {
  entry: "./src/app.js",
  output: {
    path: __dirname + "/dist",
    filename: "bundle.js"
  },
  plugins: [
    new ESLintPlugin(),
    new StylelintPlugin(),
    new MonacoWebpackPlugin(languages=["systemverilog", "json"]),
    new webpack.DefinePlugin({
      'VERSION': JSON.stringify(gitRevisionPlugin.version()),
    })
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
            "style-loader",
            "css-loader"
        ],
      },
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"]
          }
        }
      },
      {
        test: /\.ttf$/,
        use: [
          "url-loader",
        ],
      }
    ]
  }
}
