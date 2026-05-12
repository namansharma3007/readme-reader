To thoroughly test your project's rendering capabilities, you need a README that covers everything from basic Markdown to GitHub Flavored Markdown (GFM) and HTML extensions.

Below is a comprehensive "Stress Test" README. You can copy the raw code below into a file named `README.md`.

***

# 🚀 Comprehensive Markdown Rendering Test

![Build Status](https://img.shields.io/badge/build-passing-brightgreen) 
![License](https://img.shields.io/badge/license-MIT-blue) 
![Version](https://img.shields.io/badge/version-1.0.0-orange)

This repository is designed to test the full range of rendering capabilities of a Markdown parser. If all elements below are rendered correctly, your project supports a wide array of **GitHub Flavored Markdown (GFM)** and standard Markdown features.

---

## 📑 Table of Contents
- [Text Formatting](#text-formatting)
- [Lists and Tasks](#lists-and-tasks)
- [Code Blocks](#-code-blocks)
- [Tables](#-tables)
- [Quotes and Alerts](#-quotes-and-alerts)
- [Links and Images](#-links-and-images)
- [Advanced HTML Components](#-advanced-html-components)
- [Mathematics](#-mathematics)
- [Footnotes](#footnotes)

---

## ✍️ Text Formatting

Here is a demonstration of basic typography:

- **Bold text** or __Bold text__
- *Italic text* or _Italic text_
- ***Bold and Italic*** or ___Bold and Italic___
- ~~Strikethrough text~~
- `Inline code` for small snippets.
- Subscript: H~2~O (Supported by some parsers)
- Superscript: X^2^ (Supported by some parsers)

---

## 📜 Lists and Tasks

### Unordered List
* Item 1
* Item 2
  * Nested Item A
  * Nested Item B
    * Deeply Nested Item

### Ordered List
1. First item
2. Second item
   1. Sub-item 2.1
   2. Sub-item 2.2
3. Third item

### Task List (Checkboxes)
- [x] Completed task
- [ ] Pending task
- [ ] Task with ~~strikethrough~~ inside

---

## 💻 Code Blocks

### Syntax Highlighting (JavaScript)
```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}
greet('World');
```

### Syntax Highlighting (Python)
```python
def fibonacci(n):
    a, b = 0, 1
    while a < n:
        print(a, end=' ')
        a, b = b, a + b
    print()
```

### Syntax Highlighting (Bash/Shell)
```bash
mkdir test-folder
cd test-folder
touch index.html
ls -la
```

---

## 📊 Tables

| Feature | Status | Complexity | Notes |
| :--- | :---: | :---: | :--- |
| Headers | ✅ | Low | Standard alignment |
| Center Align | ✅ | Low | Used for status |
| Right Align | ✅ | Low | Used for complexity |
| Multi-line | ❌ | High | Not native to MD |

---

## 💬 Quotes and Alerts

> This is a standard blockquote.
>
> > This is a nested blockquote.
>
> Back to the first level.

***

**Note:** Some renderers support "Alerts" or "Admonitions" using special syntax:
> [!NOTE]
> Useful information that users should know.

> [!WARNING]
> Critical information to prevent mistakes.

---

## 🔗 Links and Images

### Links
- [Google](https://www.google.com) (Inline Link)
- [Internal Link to Text Formatting](#-text-formatting) (Anchor Link)
- Reference link: [My GitHub][my-github-ref]

### Images
**Standard Image:**
![Markdown Logo](https://upload.wikimedia.org/wikipedia/commons/4/48/Markdown-mark.svg)

**Linked Image:**
[![Click me!](https://via.placeholder.com/150x50?text=Click+Me)](https://www.google.com)

[my-github-ref]: https://github.com

---

## 🛠 Advanced HTML Components

### Collapsible Section (Details/Summary)
<details>
  <summary>👉 Click to expand more technical details!</summary>
  
  This content is hidden by default. It can contain:
  - Lists
  - `Code blocks`
  - Even more images!
  
  <img src="https://via.placeholder.com/100" alt="Small test image">
</details>

### Centered Content
<p align="center">
  This text is centered using an HTML <code>p</code> tag.
</p>

---

## 🧮 Mathematics

If your project supports $\LaTeX$ or KaTeX, the following should render as math:

**Inline Math:**
The Pythagorean theorem is $a^2 + b^2 = c^2$.

**Block Math:**
$$\int_{a}^{b} x^2 \,dx = \frac{b^3}{3} - \frac{a^3}{3}$$

---

## 📝 Footnotes

Here is a sentence that requires a footnote reference[^1]. And another one[^2].

[^1]: This is the first footnote explanation.
[^2]: This is the second footnote, which can be longer and provide more context about the subject matter.

---

## 🏁 Final Checklist
- [x] H1-H6 Headers
- [x] Bold/Italic/Strike
- [x] Ordered/Unordered Lists
- [x] Task Lists
- [x] Code blocks with highlighting
- [x] Tables
- [x] Blockquotes
- [x] Links & Images
- [x] HTML `<details>`
- [x] $\LaTeX$ Math
- [x] Footnotes
