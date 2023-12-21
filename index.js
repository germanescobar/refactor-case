import ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'
import { camelCase, kebabCase, pascalCase, snakeCase } from "change-case";

/**
 * Changes the case of a file or files to newCase and update the imports of the project.
 * 
 * @param {string} newCase - The case you want to change the files to (camel, snake, kebab, pascal).
 * @param {string} projectPath - The path to the project (absolute or relative).
 * @param {object} options - The options for the refactor, they are all optional:
 * - path: (string) path to a file or folder, relative to the projectPath. Defaults to "/".
 * - directory: (boolean) change the name of a directory instead of the files inside (not supported yet). Defaults to false.
 * - recursive: (boolean) if we want to change the files recursively (not supported yet). Defaults to false
 * - dryRun: (boolean) show the changes that would occur without actually updating the files.
 * @returns {Promise} an array of promises that will resolve to true if the change succeeded or false if not.
 */
export default async function refactorFilesCase(newCase, projectPath, options) {
  const fileOrFolderPath = options.path || '/'
  const fullPath = path.join(projectPath, fileOrFolderPath)
  const stat = await fs.promises.stat(fullPath)

  const caseFn = getCaseFn(newCase)

  if (stat.isDirectory()) {
    const files = await fs.promises.readdir(fullPath)
    const promises = []
    files.forEach((file) => {
      promises.push(refactorFileCase(caseFn, projectPath, file, options))
    })
    return Promise.all(promises)
  } else {
    return [await refactorFileCase(caseFn, projectPath, fileOrFolderPath, options)]
  }
}

function getCaseFn(newCase) {
  if (newCase === "camel") {
    return camelCase
  } else if (newCase === "snake") {
    return snakeCase
  } else if (newCase === "kebab") {
    return kebabCase
  } else if (newCase === "pascal") {
    return pascalCase
  }

  throw new Error(`Case "${newCase}" is not valid, possible values are: camel, snake, kebab, pascal`)
}

async function refactorFileCase(caseFn, projectPath, fileName, options) {
  if (fileName.endsWith('.ts')) {
    const oldFilePath = path.join(projectPath, fileName)
    const fileDir = path.dirname(oldFilePath)
    const newFileName = caseFn(path.basename(fileName, '.ts')) + '.ts'
    const newFilePath = path.join(fileDir, newFileName)

    await updateAllImports(projectPath, oldFilePath, newFilePath, options)
    if (!options.dryRun) {
      await fs.promises.rename(oldFilePath, newFilePath)
    }

    if (!options.dryRun) {
      console.log(`Renamed ${fileName} to ${newFilePath.replace(projectPath, "")}`)
    }
    return true
  }
  return false
}

async function updateAllImports(projectPath, oldFilePath, newFilePath, options) {
  const languageService = await createLanguageService(projectPath)

  const oldFile = oldFilePath.replace(projectPath, "")
  const newFile = newFilePath.replace(projectPath, "")
  const edits = languageService.getEditsForFileRename(oldFile, newFile, ts.testFormatSettings, ts.emptyOptions);
  if (options.dryRun) {
    console.log("********* Dry Run - Edits ************")
  }

  for (const element of edits) {
    const { fileName, textChanges } = element;
    if (options.dryRun) console.log(fileName)
    const filePath = path.join(projectPath, fileName)
    if (textChanges && textChanges.length > 0) {
      const sourceCode = await fs.promises.readFile(filePath, "utf-8"); // Read the existing file content
      let updatedCode = sourceCode;
      
      // Apply the text changes to update the file content
      textChanges.forEach((change) => {
        if (options.dryRun) {
          const substr = updatedCode.substring(change.span.start, change.span.length)
          console.log(`   Replace ${substr} with ${change.newText}`)
        }
        updatedCode = updatedCode.slice(0, change.span.start) + change.newText + updatedCode.slice(change.span.start + change.span.length);
      });

      // Write the updated content back to the file
      if (!options.dryRun) {
        await fs.promises.writeFile(filePath, updatedCode, "utf-8");
      }
    }
  }
}

async function createLanguageService(projectPath) {
  const tsconfigPath = "tsconfig.json";
  const tsconfigText = await fs.promises.readFile(path.join(projectPath, tsconfigPath), "utf-8");
  const { config, error } = ts.parseConfigFileTextToJson(tsconfigPath, tsconfigText);

  if (error) {
    throw error
  }

  const compilerOptions = config.compilerOptions;
  compilerOptions.moduleResolution =  ts.ModuleResolutionKind.Node16

  const files = [];
  return ts.createLanguageService(
    {
      getCompilationSettings: () => compilerOptions,
      getScriptFileNames: () => {
        function visitDirectory(directory) {
          if (!directory.includes("node_modules")) {
            const entries = fs.readdirSync(directory);
            for (const entry of entries) {
              const fullPath = path.join(directory, entry);
              if (fs.statSync(fullPath).isDirectory()) {
                visitDirectory(fullPath);
              } else if (entry.endsWith(".ts") || entry.endsWith(".js")) {
                const path = fullPath.replace(projectPath, "")
                files.push(path);
              }
            }
          }
        }
        if (files.length === 0) {
          visitDirectory(projectPath);
        }

        return files;
      }, 
      getScriptVersion: (fileName) => {
        // console.log("getScriptVersion fileName", fileName)
        if (fileName.includes("node_modules")) {
          return Date.now()
        }
        if (!fileName.includes("node_modules") && !fileName.startsWith(projectPath)) {
          fileName = path.join(projectPath, fileName)
        }
        try {
          return fs.statSync(fileName).mtime.getTime().toString();
        } catch (error) {
          console.error("Error inspecting file:", fileName, error);
          return Date.now()
        }
      },
      getScriptSnapshot: (fileName) => {
        if (fileName.includes("node_modules")) {
          return ts.ScriptSnapshot.fromString("");
        }
        try {
          if (!fileName.includes("node_modules") && !fileName.startsWith(projectPath)) {
            fileName = path.join(projectPath, fileName)
          }
          const fileContent = fs.readFileSync(fileName, "utf-8");
          const snapshot = ts.ScriptSnapshot.fromString(fileContent);
          return snapshot;
        } catch (error) {
          console.error("Error reading file:", fileName, error);
          return ts.ScriptSnapshot.fromString("");
        }
      },
      getDefaultLibFileName: () => ts.getDefaultLibFilePath(compilerOptions),
      getCurrentDirectory: () => projectPath,
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile
    }
  );
}