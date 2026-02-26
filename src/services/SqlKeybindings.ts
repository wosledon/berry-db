/**
 * SQL 快捷键管理
 * 提供 Datagrip 风格的快捷键支持
 */

import * as vscode from 'vscode';

export class SqlKeybindings {
  private static readonly DEFAULT_KEYBINDINGS = [
    {
      keys: 'Ctrl+Enter',
      command: 'editor.action.transform.toLowerCase',
      when: 'editorTextFocus && editorLangId === sql',
      description: '将选中文本转为小写'
    },
    {
      keys: 'Ctrl+Shift+Enter',
      command: 'editor.action.transform.toUpperCase',
      when: 'editorTextFocus && editorLangId === sql',
      description: '将选中文本转为大写'
    },
    {
      keys: 'Ctrl+Shift+L',
      command: 'editor.action.trimTrailingWhitespace',
      when: 'editorTextFocus && editorLangId === sql',
      description: '.Trim trailing whitespace'
    },
    {
      keys: 'Ctrl+Alt+L',
      command: 'editor.formatDocument',
      when: 'editorTextFocus && editorLangId === sql',
      description: '格式化 SQL 文档'
    },
    {
      keys: 'Ctrl+Shift+P',
      command: 'editor.action.triggerSuggest',
      when: 'editorTextFocus && editorLangId === sql',
      description: '触发智能提示'
    },
    {
      keys: 'Ctrl+D',
      command: 'editor.action.copyLinesDownAction',
      when: 'editorTextFocus && editorLangId === sql',
      description: '复制行'
    },
    {
      keys: 'Ctrl+Shift+K',
      command: 'editor.action.deleteLines',
      when: 'editorTextFocus && editorLangId === sql',
      description: '删除行'
    },
    {
      keys: 'Ctrl+/',
      command: 'editor.action.commentLine',
      when: 'editorTextFocus && editorLangId === sql',
      description: '注释/取消注释'
    }
  ];

  public static registerKeybindings(context: vscode.ExtensionContext): void {
    // 注册快捷键配置
    context.subscriptions.push(
      vscode.commands.registerCommand('berry-db.configureKeybindings', () => {
        vscode.workspace.getConfiguration().update('keybindings', this.DEFAULT_KEYBINDINGS, true);
        vscode.window.showInformationMessage('SQL 快捷键配置已设置');
      })
    );
  }

  public static setupKeybindings(context: vscode.ExtensionContext): void {
    // 设置 SQL 文件的快捷键
    const config = vscode.workspace.getConfiguration('editor');
    config.update('quickSuggestions', {
      strings: true,
      other: true,
      comments: false
    }, true);

    config.update('suggestionPreviewMode', 'preview', true);
  }
}
