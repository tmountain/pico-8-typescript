"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
var child_process = require("child_process");
var fse = require("fs-extra");
var path = require("path");
var yesno = require("yesno");
var commander_1 = require("commander");
var chokidar = require("chokidar");
var uglifyJS = require("uglify-js");
// Program constants (hardcoded locations)
var destDir = "p8workspace";
// This defines the default location for pico-8 on various platforms
var pico8PathMap = {
    win32: "\"C:\\Program Files (x86)\\PICO-8\\pico8.exe\"",
    darwin: "/Applications/PICO-8.app/Contents/MacOS/pico8",
    linux: "~/pico-8/pico8"
};
var program = new commander_1.Command();
program
    .command("init")
    .description("Copy the required files inside ".concat(destDir, " directory. If a file already exists, it will be skipped."))
    .action(init);
program
    .command("run")
    .description(" Build, watch, and launch your PICO-8 game")
    .action(build);
program.parse();
/**
 * Initialization code
 * Copy required files to working dir
 */
function init() {
    var toCopyDir = path.join(__dirname, "..", "tocopy");
    var toDestDir = path.join(__dirname, "..", destDir);
    // Create the destination directory if it doesn't exist
    fse.existsSync(toDestDir) || fse.mkdirSync(toDestDir);
    console.log("The following files will be added to the ".concat(toDestDir, " directory:"));
    // Fetch all files to copy
    fse.readdirSync(toCopyDir).forEach(function (file) {
        console.log(file);
    });
    yesno({ question: "Proceed to copy? (y/n)" }).then(function (ok) {
        if (!ok) {
            console.log("Stopping installation.");
            process.exit(0);
        }
        fse.readdirSync(toCopyDir).forEach(function (file) {
            var from = path.join(toCopyDir, file);
            var to = path.join(toDestDir, file);
            fse.copySync(from, to, {
                filter: function () {
                    // Avoid copying files that already exist
                    if (fse.existsSync(to)) {
                        console.log("/!\\ ".concat(file, " already exists in directory, skipping."));
                        return false;
                    }
                    return true;
                }
            });
        });
        console.log("\nCopying complete. Edit the ".concat(destDir, "/tspico8.json, then type \"bin/tscpico8 run.\""));
        process.exit(0);
    });
}
/**
 * Return a string that points to the pico-8 executable
 * or an empty string if it cannot be found.
 */
function picoPath() {
    var config = getTSPicoConfig();
    var cPico = config["pico8"];
    var picoPath = "";
    // attempt to use default locations for pico-8, and cascade to config if not found
    if (fse.existsSync(pico8PathMap[process.platform])) {
        picoPath = pico8PathMap[process.platform];
    }
    else if (fse.existsSync(cPico.executable)) {
        picoPath = cPico.executable;
    }
    return picoPath;
}
/**
 * Launch pico-8 with the game file
 */
function launchPico(picoPath, cartridgePath) {
    var picoProcess = child_process.spawn(picoPath, [
        "-sound",
        "0",
        "-run",
        "\"".concat(path.resolve(cartridgePath), "\""),
    ], {
        shell: true
    });
    picoProcess.on("close", function (code) {
        picoProcess = null;
        code && console.log("Pico-8 process exited with code ".concat(code, ".")); // eslint-disable-line no-console
    });
    return picoProcess;
}
/*
 * Run the generated JavaScript (from tsc)
 * through uglify to produce the compressed source code
 */
function makeGameFile() {
    console.log("Building game file.");
    var config = getTSPicoConfig();
    var buildStr = fse.readFileSync(getOutfile(), "utf8");
    // Explicit strict mode breaks the global TIC scope
    buildStr = buildStr.replace('"use strict";', "");
    var cCompress = config["compression"];
    var result = uglifyJS.minify(buildStr, {
        compress: cCompress.compress ? __assign({}, config["compressOptions"]) : false,
        mangle: cCompress.mangle ? __assign({}, config["mangleOptions"]) : false,
        output: {
            semicolons: false,
            beautify: !(cCompress.mangle || cCompress.compress),
            indent_level: cCompress.indentLevel,
            // Always keep the significant comments: https://github.com/nesbox/TIC-80/wiki/The-Code
            comments: cCompress.compress || cCompress.mangle
                ? RegExp(/title|author|desc|script|input|saveid/)
                : true
        }
    });
    if (result.code.length < 10) {
        console.log("Empty code.");
        console.log(buildStr);
    }
    fse.writeFileSync(getOutfileCompressed(), result.code);
    console.log("Build complete.");
}
// Location of the TypeScript config file
function getTSConfig() {
    var tsConfigPath = path.join(__dirname, "..", destDir, "tsconfig.json");
    return JSON.parse(fse.readFileSync(tsConfigPath, "utf8"));
}
// Location of the transpiler config file
function getTSPicoConfig() {
    var tsConfigPath = path.join(__dirname, "..", destDir, "tscpico8.json");
    return JSON.parse(fse.readFileSync(tsConfigPath, "utf8"));
}
// Location of the output generated by TypeScript (tsc)
function getOutfile() {
    var tsConfig = getTSConfig();
    return path.join(__dirname, "..", destDir, tsConfig.compilerOptions.outFile);
}
// Location of the output file after compression (uglified)
function getOutfileCompressed() {
    var picoConfig = getTSPicoConfig();
    return path.join(__dirname, "..", destDir, picoConfig.compression.compressedFile);
}
/**
 * Compile, compress, run
 */
function build() {
    var outFile = getOutfile();
    var outFileCompressed = getOutfileCompressed();
    var fullDestDir = path.join(__dirname, "..", destDir);
    var gameFile = path.join(fullDestDir, "game.p8");
    var spriteFile = path.join(fullDestDir, "spritesheet.png");
    var proc = null;
    chokidar
        .watch([outFile, spriteFile])
        .on("change", function (path, stats) {
        try {
            makeGameFile();
            console.log("jspicl-cli --input ".concat(outFileCompressed, " --output ").concat(gameFile, " --spritesheetImagePath ").concat(spriteFile, " --cartridgePath ").concat(gameFile));
            if (proc != null) {
                console.log("Kill old PID.");
                proc.kill();
            }
            child_process.spawn("jspicl-cli", [
                "--input ".concat(outFileCompressed),
                "--output ".concat(gameFile),
                "--spritesheetImagePath ".concat(spriteFile),
                "--cartridgePath ".concat(gameFile),
            ], { shell: true });
            // if there's a runnable pico-8, launch it.
            var pPath = picoPath();
            if (pPath.length > 0) {
                proc = launchPico(pPath, gameFile);
            }
            console.log("New build... relaunch!");
        }
        catch (e) {
            console.error(e);
        }
        // initial compile once the watcher is up and running
    })
        .on("ready", function () {
        compile(fullDestDir);
    });
    // watch for changes and update accordingly
    // don't use tsc --watch because we want more granular control
    // over the steps of the build process
    var toWatch = path.join(fullDestDir, "**/*.ts");
    chokidar.watch(toWatch).on("change", function (path, stats) {
        compile(fullDestDir);
    });
}
/*
 * Compile the TypeScript code
 */
function compile(fullDestDir) {
    console.log("Compiling TypeScript.");
    child_process.execSync("tsc", { encoding: "utf-8", cwd: fullDestDir });
    makeGameFile();
}
