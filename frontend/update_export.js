const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, 'index.html');
const exportFile = path.join(__dirname, 'Export.html');

let indexHtml = fs.readFileSync(indexFile, 'utf8');
const exportHtml = fs.readFileSync(exportFile, 'utf8');

// 1. Extract content of <main> from Export.html
const mainMatch = exportHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/);
if (!mainMatch) {
  console.error("Could not find <main> in Export.html");
  process.exit(1);
}
let exportContent = mainMatch[1].trim();

// 2. Wrap it in section
const sectionWrapper = `
      <section id="tab-export" class="tab-content flex flex-col min-h-full" style="display: none;">
        <div class="space-y-6 flex-1 pb-4">
          ${exportContent}
        </div>
      </section>
`;

// 3. Inject before </main> in index.html
indexHtml = indexHtml.replace('</main>', sectionWrapper + '\n    </main>');

// 4. Update the Export button onclick
indexHtml = indexHtml.replace(
  /<button\s+class="flex-1 flex flex-col items-center justify-center gap-1 p-1\.5 rounded-lg border border-outline bg-surface hover:bg-surface-container-low transition-colors">\s*<span class="material-symbols-outlined text-on-surface-variant text-\[16px\]">local_shipping<\/span>\s*<span class="text-\[9px\] font-semibold text-center leading-tight">3\. Export<\/span>\s*<\/button>/,
  `<button onclick="switchTab('export')"
                class="flex-1 flex flex-col items-center justify-center gap-1 p-1.5 rounded-lg border border-outline bg-surface hover:bg-surface-container-low transition-colors">
                <span class="material-symbols-outlined text-on-surface-variant text-[16px]">local_shipping</span>
                <span class="text-[9px] font-semibold text-center leading-tight">3. Export</span>
              </button>`
);

// 5. Update titles object
indexHtml = indexHtml.replace(
  "active: 'Active Farming' };",
  "active: 'Active Farming', export: 'Export Phase' };"
);

fs.writeFileSync(indexFile, indexHtml);
console.log("Updated successfully!");
