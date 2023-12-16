# Change case of files and update imports 

This tool let's you change the case of file names and update the imports accordingly in TypeScript or JavaScript projects. Supported cases are:

* kebab: this-is-an-example
* camel: thisIsAnExample
* pascal: ThisIsAnExample
* snake: this_is_an_example

You can do this programmatically or using the CLI.

## CLI Usage

1. Install the package globally:

```
npm install -g refactor-case
```

2. Invoke the tool, here is the basic usage which will refactor files inside current directory (not recursively):

```
refactor-case --to kebab
```

To refactor a specific file use the `--path` option. The path should be relative.

```
refactor-case --to kebab --path path/to/file.ts
```

See the usage with `refactor-case --help`

## Programmatic Usage

```typescript
import refactorFilesCase from 'refactor-files-case'

refactorFilesCase('kebab', '/absolute/path/to/project', { path: 'SecondFile.ts' })
  .then(results => {
    console.log(results[0] ? 'Refactor succeeded' : 'Refactor failed')
  }).catch(error => console.error(error))
```