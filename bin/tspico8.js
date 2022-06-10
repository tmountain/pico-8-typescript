#!/usr/bin/env node
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
var commander = require("commander");
var chokidar = require("chokidar");
var uglifyJS = require("uglify-js");
// This defines the default location for pico-8 on various platforms
// If none of these are found the pico-8 entry in tspico8.json is used
var pico8PathMap = {
    win32: "\"C:\\Program Files (x86)\\PICO-8\\pico8.exe\"",
    darwin: "/Applications/PICO-8.app/Contents/MacOS/pico8",
    linux: "~/pico-8/pico8"
};
// Invocations
var program = new commander.Command();
program
    .command("init")
    .description("Copy the required files to the directory specified. If a file already exists, it will be skipped.")
    .requiredOption("-d <directory>", "the directory to initialize")
    .action(function (options) {
    init(path.resolve(options.d));
});
program
    .command("run")
    .description(" Build, watch, and launch your PICO-8 game")
    .requiredOption("-d <directory>", "the directory to run the build pipeline")
    .action(function (options) {
    build(path.resolve(options.d));
});
program.parse();
// Location of the TypeScript config file
function getTSConfig(workDir) {
    var tsConfigPath = path.join(workDir, "tsconfig.json");
    return JSON.parse(fse.readFileSync(tsConfigPath, "utf8"));
}
// Location of the transpiler config file
function getTSPicoConfig(workDir) {
    var tsConfigPath = path.join(workDir, "tspico8.json");
    return JSON.parse(fse.readFileSync(tsConfigPath, "utf8"));
}
// Location of the output generated by TypeScript (tsc)
function getOutfile(workDir) {
    var tsConfig = getTSConfig(workDir);
    return path.join(workDir, tsConfig.compilerOptions.outFile);
}
// Location of the output file after compression (uglified)
function getOutfileCompressed(workDir) {
    var picoConfig = getTSPicoConfig(workDir);
    return path.join(workDir, picoConfig.compression.compressedFile);
}
/**
 * Initialization code
 * Copy required files to working dir
 */
function init(workDir) {
    var copyDir = path.join(__dirname, "..", "tocopy");
    var buildDir = path.join(workDir, "build");
    var compileDir = path.join(buildDir, "compiled.js");
    // Create the destination directory if it doesn't exist
    fse.existsSync(workDir) || fse.mkdirSync(workDir);
    // Create the build directory if it doesn't exist
    fse.existsSync(buildDir) || fse.mkdirSync(buildDir);
    // Create an empty compiled.js file if it doesn't exist
    fse.writeFile(compileDir, "", { flag: "wx" }, function (err) {
        if (err)
            throw err;
    });
    console.log("The following files will be added to the ".concat(workDir, " directory:"));
    // Fetch all files to copy
    fse.readdirSync(copyDir).forEach(function (file) {
        console.log(file);
    });
    yesno({ question: "Proceed to copy? (y/n)" }).then(function (ok) {
        if (!ok) {
            console.log("Stopping installation.");
            process.exit(0);
        }
        // Copy files to the working directory
        fse.readdirSync(copyDir).forEach(function (file) {
            var from = path.join(copyDir, file);
            var to = path.join(workDir, file);
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
        console.log("\nCopying complete. Edit the ".concat(workDir, "/tspico8.json, then type \"bin/tspico8 run.\""));
        process.exit(0);
    });
}
/**
 * Return a string that points to the pico-8 executable
 * or an empty string if it cannot be found.
 */
function picoPath(workDir) {
    var config = getTSPicoConfig(workDir);
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
function launchPico(picoPath, cartridgePath, workDir) {
    console.log("".concat(picoPath, " -root_path ").concat(workDir, " -run ").concat(path.resolve(cartridgePath)));
    var picoProcess = child_process.spawn(picoPath, ["-root_path", workDir, "-run", "\"".concat(path.resolve(cartridgePath), "\"")], {
        shell: true
    });
    picoProcess.on("close", function (code) {
        picoProcess = null;
        code && console.log("Pico-8 process exited with code ".concat(code, ".")); // eslint-disable-line no-console
    });
    return picoProcess;
}
/*
 * Compile the TypeScript code
 */
function compileTS(fullDestDir) {
    child_process.execSync("tsc", { encoding: "utf-8", cwd: fullDestDir });
}
/*
 * Run the generated JavaScript (from tsc)
 * through uglify to produce the compressed source code
 */
function compressGameFile(workDir) {
    var config = getTSPicoConfig(workDir);
    var buildStr = fse.readFileSync(getOutfile(workDir), "utf8");
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
    fse.writeFileSync(getOutfileCompressed(workDir), result.code);
}
function compileCart(jsFile, newGameFile, spriteFile, refGameFile) {
    console.log("jspicl-cli --input ".concat(jsFile, " --output ").concat(newGameFile, " --spritesheetImagePath ").concat(spriteFile, " --cartridgePath ").concat(refGameFile));
    child_process.spawnSync("jspicl-cli", [
        "--input ".concat(jsFile),
        "--output ".concat(newGameFile),
        "--spritesheetImagePath ".concat(spriteFile),
        "--cartridgePath ".concat(refGameFile),
    ], { shell: true });
}
/*
 * Assemble the assets (code and spritesheet) into a .p8 file
 */
function buildGameFile(workDir) {
    var outFileCompressed = getOutfileCompressed(workDir);
    var gameFile = path.join(workDir, "game.p8");
    var spriteFile = path.join(workDir, "spritesheet.png");
    compileCart(outFileCompressed, gameFile, spriteFile, gameFile);
}
/**
 * Compile, compress, run
 */
function build(workDir) {
    var pPath = picoPath(workDir);
    var gameFile = path.join(workDir, "game.p8");
    var toWatch = [
        path.join(workDir, "**/*.ts"),
        path.join(workDir, "spritesheet.png"),
    ];
    var proc = null;
    function buildAll() {
        console.log("Compiling TypeScript to JavaScript.");
        compileTS(workDir);
        console.log("Compressing JavaScript.");
        compressGameFile(workDir);
        console.log("Building game file.");
        buildGameFile(workDir);
        if (pPath.length > 0) {
            // Kill the existing pico-8 process if it is running
            if (proc) {
                console.log("Killing existing pico-8 process.");
                proc.kill();
            }
            console.log("Launching pico-8.");
            proc = launchPico(pPath, gameFile, workDir);
        }
    }
    // Do the initial build and launch pico-8
    buildAll();
    // watch for changes and update accordingly
    // don't use tsc --watch because we want more granular control
    // over the steps of the build process
    chokidar.watch(toWatch).on("change", function (path, stats) {
        try {
            buildAll();
        }
        catch (e) {
            console.error(e);
        }
    });
}
