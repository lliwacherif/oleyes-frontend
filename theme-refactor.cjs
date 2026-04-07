const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = [
    {
        regex: /bg-\[#060818\](\/[0-9]{2,3})?/g,
        replace: (match, opacity) => opacity ? `bg-slate-50${opacity} dark:${match}` : `bg-slate-50 dark:${match}`
    },
    {
        regex: /bg-\[#0A0D2A\](\/[0-9]{2,3})?/g,
        replace: (match, opacity) => opacity ? `bg-white${opacity} dark:${match}` : `bg-white dark:${match}`
    },
    {
        regex: /border-\[#1E2548\](\/[0-9]{2,3})?/g,
        replace: (match, opacity) => opacity ? `border-slate-200${opacity} dark:${match}` : `border-slate-200 dark:${match}`
    },
    {
        regex: /text-\[#94A3B8\]/g,
        replace: 'text-slate-600 dark:text-[#94A3B8]'
    },
    {
        regex: /text-\[#64748B\]/g,
        replace: 'text-slate-500 dark:text-[#64748B]'
    },
    {
        regex: /bg-\[#1E2548\](\/[0-9]{2,3})?/g,
        replace: (match, opacity) => opacity ? `bg-slate-200${opacity} dark:${match}` : `bg-slate-200 dark:${match}`
    }
];

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;
            for (const { regex, replace } of replacements) {
                if (regex.test(content)) {
                    content = content.replace(regex, replace);
                    changed = true;
                }
            }
            if (changed) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

console.log("Starting theme refactoring...");
processDirectory(srcDir);
console.log("Done.");
