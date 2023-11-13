import ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'
import { camelCase, kebabCase, pascalCase, snakeCase } from "change-case";

/**
 * Changes the case of a file or files to newCase and update the imports of the project.
 * 
 * @param {string} newCase - The case you want to change the files to (camel, snake, kebab, pascal).
 * @param {string} projectPath - The path to the project (absolute or relative).
 * @param {string} fileOrFolderPath - The path to the file or folder relative to the projectPath. Defaults to '/'.
 * @returns {Promise}
 */
export default async function refactorFilesCase(newCase, projectPath, fileOrFolderPath='/') {
  const fullPath = path.join(projectPath, fileOrFolderPath)
  const stat = await fs.promises.stat(fullPath)

  const caseFn = getCaseFn(newCase)

  if (stat.isDirectory()) {
    const files = await fs.promises.readdir(fullPath)
    const promises = []
    files.forEach((file) => {
      promises.push(refactorFileCase(caseFn, projectPath, file))
    })
    return Promise.all(promises)
  } else {
    return refactorFileCase(caseFn, projectPath, fileOrFolderPath)
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

async function refactorFileCase(caseFn, projectPath, file) {
  if (file.endsWith('.ts')) {
    const oldFilePath = path.join(projectPath, file)
    const newFileName = caseFn(path.basename(file, '.ts')) + '.ts'
    const newFilePath = path.join(projectPath, newFileName)

    await updateAllImports(projectPath, oldFilePath, newFilePath)
    await fs.promises.rename(oldFilePath, newFilePath)

    console.log(`Renamed ${file} to ${newFileName}`)
    return true
  }
  return false
}

async function updateAllImports(projectPath, oldFilePath, newFilePath) {
  const tsconfigPath = "tsconfig.json"; // Provide the path to your tsconfig.json file
  const tsconfigText = await fs.promises.readFile(path.join(projectPath, tsconfigPath), "utf-8");
  const { config, error } = ts.parseConfigFileTextToJson(tsconfigPath, tsconfigText);

  if (error) {
    console.error("Error parsing tsconfig.json:", error);
    process.exit(1);
  }

  const compilerOptions = config.compilerOptions;

  const languageService = ts.createLanguageService(
    {
      getCompilationSettings: () => compilerOptions,
      getScriptFileNames: () => {
        const files = [];
        function visitDirectory(directory) {
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
        visitDirectory(projectPath);
        return files;
      }, 
      getScriptVersion: (fileName) => {
        if (!fileName.includes("node_modules")) {
          fileName = path.join(projectPath, fileName)
        }
        return fs.statSync(fileName).mtime.getTime().toString();
      },
      getScriptSnapshot: (fileName) => {
        try {
          if (!fileName.includes("node_modules")) {
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

  const oldFile = oldFilePath.replace(projectPath, "")
  const newFile = newFilePath.replace(projectPath, "")
  console.log("Project Path:", projectPath)
  console.log(oldFile, newFile)
  const edits = languageService.getEditsForFileRename(oldFile, newFile, ts.testFormatSettings, ts.emptyOptions);
  console.log("********* EDITS ************")

  for (let i=0; i < edits.length; i++) {
    const { fileName, textChanges } = edits[i];
    console.log(fileName)
    console.log(textChanges)
    const filePath = path.join(projectPath, fileName)
    if (textChanges && textChanges.length > 0) {
      const sourceCode = await fs.promises.readFile(filePath, "utf-8"); // Read the existing file content
      let updatedCode = sourceCode;
      
      // Apply the text changes to update the file content
      textChanges.forEach((change) => {
        updatedCode = updatedCode.slice(0, change.span.start) + change.newText + updatedCode.slice(change.span.start + change.span.length);
      });

      // Write the updated content back to the file
      await fs.promises.writeFile(filePath, updatedCode, "utf-8");
    }
  }
}