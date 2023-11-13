import * as fs from 'fs'
import * as url from 'url'
import refactorFilesCase from '../index.js'

describe('refactor files case', () => {
  it('refactors one file', async () => {
    const currentPath = url.fileURLToPath(new URL('.', import.meta.url));
    await fs.promises.cp(currentPath + '/fixtures', currentPath + '/fixtures-run', { recursive: true })
    await refactorFilesCase('kebab', currentPath + 'fixtures-run', 'SecondFile.ts')

    const firstFile = await fs.promises.readFile(currentPath + 'fixtures-run/FirstFile.ts', 'utf8')
    expect(firstFile).toContain('import SecondFile from \'./second-file\'')

    const thirdFile = await fs.promises.readFile(currentPath + 'fixtures-run/third-file.ts', 'utf8')
    expect(thirdFile).toContain('import SecondFile from \'./second-file\'')

    const fourthFile = await fs.promises.readFile(currentPath + 'fixtures-run/inner/fourthFile.ts', 'utf8')
    expect(fourthFile).toContain('import SecondFile from \'../second-file\'')
  })
})