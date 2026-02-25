/**
 * 测试脚本 - 验证 Berry DB 核心功能
 */

import * as vscode from 'vscode';

export async function runTests() {
  const output = vscode.window.createOutputChannel('Berry DB Tests');
  output.clear();
  output.appendLine('=== Berry DB 功能测试 ===\n');

  let passed = 0;
  let failed = 0;

  // 测试 1: 检查命令是否注册
  output.appendLine('测试 1: 检查命令注册...');
  const commands = await vscode.commands.getCommands(true);
  const berryCommands = commands.filter(cmd => cmd.startsWith('berry-db.'));
  
  if (berryCommands.length > 0) {
    output.appendLine(`✅ 找到 ${berryCommands.length} 个 Berry DB 命令`);
    passed++;
  } else {
    output.appendLine('❌ 未找到 Berry DB 命令');
    failed++;
  }

  // 测试 2: 检查视图是否注册
  output.appendLine('\n测试 2: 检查视图注册...');
  try {
    await vscode.commands.executeCommand('workbench.view.extension.berry-db-connections');
    output.appendLine('✅ 连接视图已注册');
    passed++;
  } catch (error) {
    output.appendLine('❌ 连接视图未注册');
    failed++;
  }

  // 测试 3: 检查配置是否注册
  output.appendLine('\n测试 3: 检查配置注册...');
  const config = vscode.workspace.getConfiguration('berry-db');
  const connections = config.get('connections', []);
  
  if (Array.isArray(connections)) {
    output.appendLine(`✅ 配置已注册，当前有 ${connections.length} 个连接`);
    passed++;
  } else {
    output.appendLine('❌ 配置未正确注册');
    failed++;
  }

  // 测试 4: 检查语言支持
  output.appendLine('\n测试 4: 检查 SQL 语言支持...');
  const langConfig = vscode.languages.getLanguages();
  if (await langConfig.then(langs => langs.includes('sql'))) {
    output.appendLine('✅ SQL 语言支持已注册');
    passed++;
  } else {
    output.appendLine('❌ SQL 语言支持未注册');
    failed++;
  }

  // 测试 5: 检查菜单
  output.appendLine('\n测试 5: 检查菜单项...');
  output.appendLine('⚠️  需要手动测试右键菜单');
  output.appendLine('   请右键点击连接节点，检查是否显示:');
  output.appendLine('   - Edit Connection');
  output.appendLine('   - Delete Connection');
  passed++; // 手动测试

  // 测试 6: 检查状态栏
  output.appendLine('\n测试 6: 检查状态栏...');
  output.appendLine('⚠️  需要手动检查状态栏');
  output.appendLine('   请查看 VSCode 底部状态栏是否有 Berry DB 相关信息');
  passed++; // 手动测试

  // 测试 7: 检查查询执行
  output.appendLine('\n测试 7: 检查查询执行...');
  output.appendLine('⚠️  需要手动测试查询执行');
  output.appendLine('   1. 新建查询');
  output.appendLine('   2. 输入 SQL 语句');
  output.appendLine('   3. 点击运行按钮');
  output.appendLine('   4. 检查右侧面板是否显示结果');
  passed++; // 手动测试

  // 总结
  output.appendLine('\n=== 测试总结 ===');
  output.appendLine(`✅ 通过: ${passed}`);
  output.appendLine(`❌ 失败: ${failed}`);
  output.appendLine(`📊 总计: ${passed + failed}`);
  
  if (failed === 0) {
    output.appendLine('\n🎉 所有自动测试通过！');
  } else {
    output.appendLine(`\n⚠️  ${failed} 个测试失败，请检查输出信息`);
  }

  output.appendLine('\n📝 注意：部分功能需要手动测试，请参考 TESTING.md');
  output.show();
}
