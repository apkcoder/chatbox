const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

// 要删除的开发相关文件和文件夹模式
const patternsToRemove = [
  // 测试文件和文件夹
  '*.spec.js',
  '*.test.js',
  'test',
  'tests',
  'jest*',
  'mocha*',
  'cypress*',
  
  // 文档和示例
  'docs',
  'doc',
  'example',
  'examples',
  'demo',
  'demos',
  '*.md',
  '*.markdown',
  '*.txt',
  
  // 源代码和开发文件
  'src',
  'ts',
  'typescript',
  '*.ts',
  '.github',
  '.vscode',
  'bower.json',
  'package-lock.json',
  'yarn.lock',
  'rollup.config.js',
  'webpack.config.js',
  'babel.config.js',
  'tsconfig.json',
  'eslint*',
  'prettier*',
  'coverage',
  
  // 其他不需要的文件
  '.npmignore',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.nvmrc',
  '.travis.yml',
  '.circleci',
  'CHANGELOG*',
  'AUTHORS*',
  'CONTRIBUTING*',
  'LICENSE*'
];

// 需要保留的重要依赖
const keysToKeep = [
  'react', 
  'react-dom', 
  'electron-updater',
  'katex',
  'jotai',
  '@mui',
  'eventsource-parser',
  'uuid'
];

async function cleanNodeModules() {
  console.log('Starting dependency optimization...');
  const releaseAppNodeModulesPath = path.join(__dirname, '../../release/app/node_modules');
  
  // 如果release/app/node_modules不存在，退出
  if (!fs.existsSync(releaseAppNodeModulesPath)) {
    console.log('No node_modules folder found in release/app.');
    return;
  }
  
  // 遍历node_modules文件夹
  const packages = await fs.readdir(releaseAppNodeModulesPath);
  
  for (const pkg of packages) {
    // 跳过.开头的文件或文件夹
    if (pkg.startsWith('.')) continue;
    
    // 检查是否是需要保留的依赖
    const shouldKeep = keysToKeep.some(key => pkg === key || pkg.startsWith(`${key}/`));
    
    if (!shouldKeep) {
      const pkgPath = path.join(releaseAppNodeModulesPath, pkg);
      
      try {
        // 获取包中所有文件和文件夹
        const files = [];
        for (const pattern of patternsToRemove) {
          const matches = glob.sync(pattern, { 
            cwd: pkgPath, 
            absolute: true,
            dot: true,
            nodir: false
          });
          files.push(...matches);
        }
        
        // 删除找到的文件和文件夹
        for (const file of files) {
          try {
            if (fs.existsSync(file)) {
              const stat = fs.statSync(file);
              if (stat.isDirectory()) {
                fs.removeSync(file);
              } else {
                fs.unlinkSync(file);
              }
              console.log(`Removed: ${file}`);
            }
          } catch (err) {
            console.error(`Error removing ${file}:`, err);
          }
        }
      } catch (err) {
        console.error(`Error processing ${pkg}:`, err);
      }
    } else {
      console.log(`Keeping important dependency: ${pkg}`);
    }
  }
  
  console.log('Dependency optimization completed!');
}

cleanNodeModules().catch(err => {
  console.error('Error during optimization:', err);
  process.exit(1);
}); 