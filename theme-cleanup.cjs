const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// Phase 1: Fix duplicated dark: classes from running refactor script multiple times
const dupeFixups = [
    // Fix triple/double dark: stacking patterns
    { regex: /bg-white\/60 dark:bg-white\/60 dark:bg-white\/60 dark:bg-\[#0A0D2A\]\/60/g, replace: 'bg-white/60 dark:bg-[#0A0D2A]/60' },
    { regex: /bg-white\/80 dark:bg-white\/80 dark:bg-white\/80 dark:bg-\[#0A0D2A\]\/80/g, replace: 'bg-white/80 dark:bg-[#0A0D2A]/80' },
    { regex: /bg-white\/40 dark:bg-white\/40 dark:bg-white\/40 dark:bg-\[#0A0D2A\]\/40/g, replace: 'bg-white/40 dark:bg-[#0A0D2A]/40' },
    { regex: /bg-white\/50 dark:bg-white\/50 dark:bg-white\/50 dark:bg-\[#0A0D2A\]\/50/g, replace: 'bg-white/50 dark:bg-[#0A0D2A]/50' },
    { regex: /bg-white\/95 dark:bg-white\/95 dark:bg-white\/95 dark:bg-\[#0A0D2A\]\/95/g, replace: 'bg-white/95 dark:bg-[#0A0D2A]/95' },
    { regex: /bg-white dark:bg-white dark:bg-white dark:bg-\[#0A0D2A\]/g, replace: 'bg-white dark:bg-[#0A0D2A]' },
    { regex: /bg-slate-50\/80 dark:bg-slate-50\/80 dark:bg-slate-50\/80 dark:bg-\[#060818\]\/80/g, replace: 'bg-slate-50/80 dark:bg-[#060818]/80' },
    { regex: /bg-slate-50\/60 dark:bg-slate-50\/60 dark:bg-slate-50\/60 dark:bg-\[#060818\]\/60/g, replace: 'bg-slate-50/60 dark:bg-[#060818]/60' },
    { regex: /bg-slate-50\/50 dark:bg-slate-50\/50 dark:bg-slate-50\/50 dark:bg-\[#060818\]\/50/g, replace: 'bg-slate-50/50 dark:bg-[#060818]/50' },
    { regex: /bg-slate-50\/80 dark:bg-slate-50\/80 dark:bg-slate-50\/80 dark:bg-\[#060818\]\/80/g, replace: 'bg-slate-50/80 dark:bg-[#060818]/80' },

    { regex: /border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-\[#1E2548\]/g, replace: 'border-slate-200 dark:border-[#1E2548]' },
    { regex: /border-slate-200\/50 dark:border-slate-200\/50 dark:border-slate-200\/50 dark:border-\[#1E2548\]\/50/g, replace: 'border-slate-200/50 dark:border-[#1E2548]/50' },
    { regex: /border-slate-200\/30 dark:border-slate-200\/30 dark:border-slate-200\/30 dark:border-\[#1E2548\]\/30/g, replace: 'border-slate-200/30 dark:border-[#1E2548]/30' },
    { regex: /border-slate-200\/80 dark:border-slate-200\/80 dark:border-slate-200\/80 dark:border-\[#1E2548\]\/80/g, replace: 'border-slate-200/80 dark:border-[#1E2548]/80' },

    { regex: /text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-\[#94A3B8\]/g, replace: 'text-slate-600 dark:text-[#94A3B8]' },
    { regex: /text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-\[#64748B\]/g, replace: 'text-slate-500 dark:text-[#64748B]' },
    
    { regex: /bg-slate-200 dark:bg-slate-200 dark:bg-slate-200 dark:bg-\[#1E2548\]/g, replace: 'bg-slate-200 dark:bg-[#1E2548]' },
    { regex: /bg-slate-200\/50 dark:bg-slate-200\/50 dark:bg-slate-200\/50 dark:bg-\[#1E2548\]\/50/g, replace: 'bg-slate-200/50 dark:bg-[#1E2548]/50' },
    { regex: /bg-slate-200\/30 dark:bg-slate-200\/30 dark:bg-slate-200\/30 dark:bg-\[#1E2548\]\/30/g, replace: 'bg-slate-200/30 dark:bg-[#1E2548]/30' },
];

// Phase 2: Add light-mode alternatives for remaining hardcoded dark colors
const lightThemeRules = [
    // Input/panel backgrounds
    { regex: /bg-\[#121738\](?![\w/])/g, replace: 'bg-slate-100 dark:bg-[#121738]' },
    { regex: /bg-\[#121738\]\/50/g, replace: 'bg-slate-100/50 dark:bg-[#121738]/50' },
    { regex: /bg-\[#121738\]\/30/g, replace: 'bg-slate-100/30 dark:bg-[#121738]/30' },
    { regex: /bg-\[#121738\]\/60/g, replace: 'bg-slate-100/60 dark:bg-[#121738]/60' },
    
    // Dark panels
    { regex: /bg-\[#0A0A0B\]/g, replace: 'bg-slate-50 dark:bg-[#0A0A0B]' },
    { regex: /border-\[#2A2A35\]/g, replace: 'border-slate-200 dark:border-[#2A2A35]' },
    { regex: /bg-\[#050505\]/g, replace: 'bg-white dark:bg-[#050505]' },

    // Text colors
    { regex: /text-\[#E2E8F0\]/g, replace: 'text-slate-800 dark:text-[#E2E8F0]' },
    { regex: /text-\[#CBD5E1\]/g, replace: 'text-slate-600 dark:text-[#CBD5E1]' },

    // Fix bg-black usages (only standalone, not bg-black/)
    { regex: /bg-black(?=[\s"'])/g, replace: 'bg-white dark:bg-black' },
    
    // border-white/10 and border-white/5 patterns
    { regex: /border-white\/10/g, replace: 'border-slate-200 dark:border-white/10' },
    { regex: /border-white\/5/g, replace: 'border-slate-100 dark:border-white/5' },
    { regex: /border-white\/20/g, replace: 'border-slate-300 dark:border-white/20' },

    // bg-white/5 patterns (cards/panels in Settings/ZoneRules)
    { regex: /bg-white\/5(?!\d)/g, replace: 'bg-slate-50 dark:bg-white/5' },
    { regex: /bg-white\/10/g, replace: 'bg-slate-100 dark:bg-white/10' },
    { regex: /bg-white\/20/g, replace: 'bg-slate-200 dark:bg-white/20' },
    { regex: /bg-white\/\[0\.02\]/g, replace: 'bg-slate-50/50 dark:bg-white/[0.02]' },
    { regex: /bg-white\/\[0\.03\]/g, replace: 'bg-slate-100/50 dark:bg-white/[0.03]' },

    // bg-black/20 and bg-black/40 patterns (settings inputs)
    { regex: /bg-black\/20/g, replace: 'bg-slate-100 dark:bg-black/20' },
    { regex: /bg-black\/40/g, replace: 'bg-slate-200 dark:bg-black/40' },
    { regex: /bg-black\/10/g, replace: 'bg-slate-50 dark:bg-black/10' },

    // Modal backgrounds
    { regex: /bg-neutral-900(?![\w/])/g, replace: 'bg-white dark:bg-neutral-900' },

    // Misc text
    { regex: /text-neutral-600(?![\w/])/g, replace: 'text-slate-400 dark:text-neutral-600' },
    { regex: /text-neutral-700/g, replace: 'text-slate-400 dark:text-neutral-700' },

    // System Online badge dark bg
    { regex: /bg-\[#061813\]/g, replace: 'bg-emerald-50 dark:bg-[#061813]' },

    // Critical events dark bg
    { regex: /bg-\[#1a0f14\]/g, replace: 'bg-red-50 dark:bg-[#1a0f14]' },

    // Fix gradient header text on Cameras page  
    { regex: /from-white to-neutral-500/g, replace: 'from-slate-900 to-slate-500 dark:from-white dark:to-neutral-500' },

    // divide-white/5
    { regex: /divide-white\/5/g, replace: 'divide-slate-100 dark:divide-white/5' },
];

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === 'dist') continue;
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;

            // Phase 1: cleanup duplicates
            for (const { regex, replace } of dupeFixups) {
                const before = content;
                content = content.replace(regex, replace);
                if (content !== before) changed = true;
            }

            // Phase 2: add light variants
            for (const { regex, replace } of lightThemeRules) {
                const before = content;
                content = content.replace(regex, replace);
                if (content !== before) changed = true;
            }

            if (changed) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

console.log("Starting comprehensive theme cleanup...");
processDirectory(srcDir);
console.log("Done.");
