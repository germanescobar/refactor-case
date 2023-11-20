#! /usr/bin/env node

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

  const opts = program.opts()
  const newCase = opts.to
  const path = opts.path || ''

  if (!process.argv.slice(2).length) {
    program.outputHelp()
    return
  }

  const options = {
    directory: false,
    recursive: false,
    dryRun: false
  }
  if (opts.path) options.path = opts.path
  if (opts.directory) options.directory = true
  if (opts.recursive) options.recursive = true
  if (opts.dryRun) options.dryRun = true

  try {
    const rootPath = url.fileURLToPath(new URL('.', import.meta.url));
    const result = await refactorFilesCase(newCase, rootPath, options)
    if (Array.isArray(result)) {
      const count = result.filter(e => e).length
      if (!options.dryRun) console.log(`${count} files refactored`)
    } else {
      if (!options.dryRun) console.log(`${result ? 1 : 0} files refactored`)
    }

    if (options.dryRun) console.log('This was a dry run. No files changed!')
  } catch (e) {
    console.log(e)
  }
}

run()