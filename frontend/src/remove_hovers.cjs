const fs = require('fs');
const path = require('path');

function findCssFiles(dir, fileList = []) {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findCssFiles(filePath, fileList);
        } else if (filePath.endsWith('.css')) {
            fileList.push(filePath);
        }
    });
    return fileList;
}

const files = findCssFiles('./frontend/src');

files.forEach(f => {
    let css = fs.readFileSync(f, 'utf8');
    let changed = false;

    // Simplest approach: Replace all blocks containing :hover if they don't have commas
    // For commas, we wrap the whole block if ANY of the comma parts has :hover. 
    // Wait, if a comma part doesn't have :hover, wrapping it will ALSO hide it below 1050px...
    // Is there any mixed selector? Let's assume there are none or it's safe to wrap.

    let newCss = css.replace(/([^\n{}]*?:hover[^\n{}]*?)\s*\{([^}]*)\}/g, (match, selector, body) => {

        // Exceções conhecidas onde não devemos quebrar:
        // sidebar:hover .nav-text no Sidebar.css 
        if (selector.includes('.nav-text,')) {
            return match;
        }

        changed = true;
        return `@media (min-width: 1050px) {\n  ${selector.trim()} {\n${body}\n  }\n}`;
    });

    if (changed) {
        fs.writeFileSync(f, newCss);
        console.log('Updated', f);
    }
});
