# 毛概机考刷题

一个可本地运行的静态刷题 app。打开 `index.html` 即可使用，不需要安装运行环境。

当前题库共 1110 题，来源包括 `毛概-选择题库大全(参考答案完整版).pdf`、`source-word-chapters` 中的 8 份分章 Word 题库，以及 `source-extra-docx` 中两份“每五题附答案”的 Word 题库。导入时会按题干和选项去重。

## 使用

1. 双击 `index.html`。
2. 选择全部题目、只刷错题、单元或题型。
3. 答错的题会自动进入错题本，并记录上次错选的选项、正确选项和错误次数。
4. 在错题本里点击“重刷这题”可以重新作答，答对后会自动移出错题本。

## 分享给同学

把整个文件夹压缩后发给同学即可，至少需要包含：

- `index.html`
- `styles.css`
- `app.js`
- `questions.js`

## 重新导入题库

把新的 PDF 或 docx 放进当前文件夹，或放进 `source-word-chapters` 文件夹，然后运行：

```powershell
C:\Users\栗海粟\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe .\tools\import_questions.py
```

目前可稳定导入带文字层的 PDF 和 `.docx`。图片扫描版 PDF、旧版 `.doc` 需要先 OCR 或转换成 `.docx`。本文件夹里的 `2023版毛概练习-第X章_decrypted.pdf` 暂时属于图片扫描版，所以没有进入首版题库。
