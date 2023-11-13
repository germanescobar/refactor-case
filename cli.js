import { program } from 'commander'
import * as url from 'url'
import refactorFilesCase from './index.js'

async function run() {
  program
    .description("Changes the case of TypeScript or JavaScript files and update imports. You should run this command at the root of your project.")
    .requiredOption('--to <case>', 'Required. Specify the new case for the files: camel, kebab, snake or pascal.')
    .option('-p, --path <path>', 'The path of a single file or directory (where the files are). Defaults to current directory.')
    .option('-d, --directory', 'In case you want to change the name of a directory instead of the files inside.')
    .option('-r, --recursive', 'Change files recursively (inside subdirectories).')
    .option('--dry-run', 'Don\'t modify any file, just print the changes that would occur.')

  program.parse()

  const options = program.opts()
  const newCase = options.to
  const path = options.path || ''

  if (!process.argv.slice(2).length) {
    program.outputHelp()
    return
  }

  try {
    const projectPath = url.fileURLToPath(new URL('.', import.meta.url));
    const result = await refactorFilesCase(newCase, projectPath, path)
    if (Array.isArray(result)) {
      const count = result.filter(e => e).length
      console.log(`${count} files refactored`)
    } else {
      console.log(`${result ? 1 : 0} files refactored`)
    }
  } catch (e) {
    console.log(e)
  }
}

run()