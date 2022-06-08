import * as child_process from "child_process";
import * as fse from "fs-extra";
import * as path from "path";
import * as yesno from "yesno";
import { Command } from "commander";
import * as chokidar from "chokidar";
import * as uglifyJS from "uglify-js";

// Program constants (hardcoded locations)
const destDir = "p8workspace";
// This defines the default location for pico-8 on various platforms
const pico8PathMap = {
  win32: `"C:\\Program Files (x86)\\PICO-8\\pico8.exe"`, // eslint-disable-line quotes
  darwin: "/Applications/PICO-8.app/Contents/MacOS/pico8",
  linux: "~/pico-8/pico8",
};

const program = new Command();
program
  .command("init")
  .description(
    `Copy the required files inside ${destDir} directory. If a file already exists, it will be skipped.`,
  )
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
function init(): void {
  const toCopyDir = path.join(__dirname, "..", "tocopy");
  const toDestDir = path.join(__dirname, "..", destDir);

  // Create the destination directory if it doesn't exist
  fse.existsSync(toDestDir) || fse.mkdirSync(toDestDir);

  console.log(
    `The following files will be added to the ${toDestDir} directory:`,
  );

  // Fetch all files to copy
  fse.readdirSync(toCopyDir).forEach((file) => {
    console.log(file);
  });

  yesno({ question: "Proceed to copy? (y/n)" }).then((ok) => {
    if (!ok) {
      console.log("Stopping installation.");
      process.exit(0);
    }

    fse.readdirSync(toCopyDir).forEach((file: string) => {
      const from = path.join(toCopyDir, file);
      const to = path.join(toDestDir, file);
      fse.copySync(from, to, {
        filter: () => {
          // Avoid copying files that already exist
          if (fse.existsSync(to)) {
            console.log(`/!\\ ${file} already exists in directory, skipping.`);
            return false;
          }
          return true;
        },
      });
    });

    console.log(
      `\nCopying complete. Edit the ${destDir}/tspico8.json, then type "bin/tscpico8 run."`,
    );
    process.exit(0);
  });
}

/**
 * Return a string that points to the pico-8 executable
 * or an empty string if it cannot be found.
 */
function picoPath(): string {
  const config = getTSPicoConfig();
  const cPico: {
    executable: string;
  } = config["pico8"];

  let picoPath = "";

  // attempt to use default locations for pico-8, and cascade to config if not found
  if (fse.existsSync(pico8PathMap[process.platform])) {
    picoPath = pico8PathMap[process.platform];
  } else if (fse.existsSync(cPico.executable)) {
    picoPath = cPico.executable;
  }
  return picoPath;
}

/**
 * Launch pico-8 with the game file
 */
function launchPico(
  picoPath: string,
  cartridgePath: string,
): child_process.ChildProcessWithoutNullStreams {
  let picoProcess = child_process.spawn(
    picoPath,
    [
      "-sound",
      "0", // Disable sound
      "-run",
      `"${path.resolve(cartridgePath)}"`,
    ],
    {
      shell: true,
    },
  );

  picoProcess.on("close", (code) => {
    picoProcess = null;
    code && console.log(`Pico-8 process exited with code ${code}.`); // eslint-disable-line no-console
  });
  return picoProcess;
}

/*
 * Run the generated JavaScript (from tsc)
 * through uglify to produce the compressed source code
 */
function makeGameFile(): void {
  console.log("Building game file.");
  let config = getTSPicoConfig();
  let buildStr = fse.readFileSync(getOutfile(), "utf8");
  // Explicit strict mode breaks the global TIC scope
  buildStr = buildStr.replace('"use strict";', "");

  const cCompress: {
    compressedFile: string;
    indentLevel: number;
    compress: boolean;
    mangle: boolean;
  } = config["compression"];

  const result = uglifyJS.minify(buildStr, {
    compress: cCompress.compress ? { ...config["compressOptions"] } : false,
    mangle: cCompress.mangle ? { ...config["mangleOptions"] } : false,
    output: {
      semicolons: false, // Only works if `mangle` or `compress` are set to false
      beautify: !(cCompress.mangle || cCompress.compress),
      indent_level: cCompress.indentLevel,
      // Always keep the significant comments: https://github.com/nesbox/TIC-80/wiki/The-Code
      comments:
        cCompress.compress || cCompress.mangle
          ? RegExp(/title|author|desc|script|input|saveid/)
          : true,
    },
  });

  if (result.code.length < 10) {
    console.log("Empty code.");
    console.log(buildStr);
  }
  fse.writeFileSync(getOutfileCompressed(), result.code);
  console.log("Build complete.");
}

// Location of the TypeScript config file
function getTSConfig(): any {
  const tsConfigPath = path.join(__dirname, "..", destDir, "tsconfig.json");
  return JSON.parse(fse.readFileSync(tsConfigPath, "utf8"));
}

// Location of the transpiler config file
function getTSPicoConfig(): any {
  const tsConfigPath = path.join(__dirname, "..", destDir, "tscpico8.json");
  return JSON.parse(fse.readFileSync(tsConfigPath, "utf8"));
}

// Location of the output generated by TypeScript (tsc)
function getOutfile(): string {
  const tsConfig = getTSConfig();
  return path.join(__dirname, "..", destDir, tsConfig.compilerOptions.outFile);
}

// Location of the output file after compression (uglified)
function getOutfileCompressed(): string {
  const picoConfig = getTSPicoConfig();
  return path.join(
    __dirname,
    "..",
    destDir,
    picoConfig.compression.compressedFile,
  );
}

/**
 * Compile, compress, run
 */
function build(): void {
  const outFile = getOutfile();
  const outFileCompressed = getOutfileCompressed();
  const fullDestDir = path.join(__dirname, "..", destDir);
  const gameFile = path.join(fullDestDir, "game.p8");
  const spriteFile = path.join(fullDestDir, "spritesheet.png");
  let proc: child_process.ChildProcess = null;

  chokidar
    .watch([outFile, spriteFile])
    .on("change", (path, stats) => {
      try {
        makeGameFile();
        console.log(
          `jspicl-cli --input ${outFileCompressed} --output ${gameFile} --spritesheetImagePath ${spriteFile} --cartridgePath ${gameFile}`,
        );

        if (proc != null) {
          console.log("Kill old PID.");
          proc.kill();
        }

        child_process.spawn(
          "jspicl-cli",
          [
            `--input ${outFileCompressed}`,
            `--output ${gameFile}`,
            `--spritesheetImagePath ${spriteFile}`,
            `--cartridgePath ${gameFile}`,
          ],
          { shell: true },
        );
        // if there's a runnable pico-8, launch it.
        let pPath = picoPath();
        if (pPath.length > 0) {
          proc = launchPico(pPath, gameFile);
        }
        console.log("New build... relaunch!");
      } catch (e) {
        console.error(e);
      }
      // initial compile once the watcher is up and running
    })
    .on("ready", () => {
      compile(fullDestDir);
    });

  // watch for changes and update accordingly
  // don't use tsc --watch because we want more granular control
  // over the steps of the build process
  let toWatch = path.join(fullDestDir, "**/*.ts");
  chokidar.watch(toWatch).on("change", (path, stats) => {
    compile(fullDestDir);
  });
}

/*
 * Compile the TypeScript code
 */
function compile(fullDestDir: string): void {
  console.log("Compiling TypeScript.");
  child_process.execSync("tsc", { encoding: "utf-8", cwd: fullDestDir });
  makeGameFile();
}
