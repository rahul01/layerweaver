/**
 * generate-syllabus.js
 * Generates the Summer Camp syllabus PDF using puppeteer-core + system Chrome.
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #1a1a1a;
    font-size: 9.5pt;
    line-height: 1.4;
    padding: 24px 36px;
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #A083D5;
    padding-bottom: 10px;
    margin-bottom: 12px;
  }
  .brand { font-size: 18pt; font-weight: 800; color: #A083D5; letter-spacing: -0.5px; }
  .badge {
    background: #EFCF20;
    color: #1a1a1a;
    font-weight: 700;
    font-size: 8pt;
    padding: 4px 12px;
    border-radius: 20px;
    letter-spacing: 0.5px;
  }

  /* Title block */
  .title-block { margin-bottom: 10px; }
  .title-block h1 { font-size: 14pt; font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }
  .title-block p { color: #555; font-size: 9pt; }

  /* Meta row */
  .meta {
    display: flex;
    gap: 20px;
    background: #f7f4fe;
    border-radius: 6px;
    padding: 8px 14px;
    margin-bottom: 12px;
    font-size: 9pt;
  }
  .meta-item { display: flex; align-items: center; gap: 6px; }
  .meta-label { font-weight: 600; color: #A083D5; }

  /* Description */
  .description {
    background: #fffdf0;
    border-left: 4px solid #EFCF20;
    padding: 7px 12px;
    border-radius: 0 6px 6px 0;
    margin-bottom: 12px;
    font-size: 9.5pt;
    color: #333;
  }

  /* Outcomes */
  .section-title {
    font-size: 9pt;
    font-weight: 700;
    color: #A083D5;
    margin-bottom: 5px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .outcomes { margin-bottom: 12px; }
  .outcomes ul { padding-left: 16px; }
  .outcomes li { margin-bottom: 2px; font-size: 9.5pt; }

  /* Sessions */
  .sessions { }
  .session {
    border: 1px solid #e8e0f5;
    border-radius: 6px;
    margin-bottom: 6px;
    overflow: hidden;
  }
  .session-header {
    background: #f7f4fe;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .session-num {
    background: #A083D5;
    color: #fff;
    font-weight: 700;
    font-size: 8pt;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .session-title { font-weight: 600; font-size: 9.5pt; color: #1a1a1a; }
  .session-duration { margin-left: auto; font-size: 8.5pt; color: #888; white-space: nowrap; }
  .session-body { padding: 6px 12px; font-size: 9pt; color: #444; }

  /* Footer */
  .footer {
    margin-top: 14px;
    border-top: 1px solid #e8e0f5;
    padding-top: 8px;
    display: flex;
    justify-content: space-between;
    font-size: 8pt;
    color: #999;
  }
</style>
</head>
<body>

<div class="header">
  <div class="brand">LayerWeaver</div>
  <div class="badge">SUMMER SPECIAL</div>
</div>

<div class="title-block">
  <h1>Summer Camp: 3D Printing Exploration</h1>
  <p>Course Syllabus - Hands-on 3D Printing for Students &amp; Beginners</p>
</div>

<div class="meta">
  <div class="meta-item"><span class="meta-label">Duration:</span> 12 Hours total</div>
  <div class="meta-item"><span class="meta-label">Sessions:</span> 6 × 2 Hours</div>
  <div class="meta-item"><span class="meta-label">Level:</span> Beginners</div>
  <div class="meta-item"><span class="meta-label">Style:</span> Interactive &amp; Hands-on</div>
</div>

<div class="description">
  A hands-on summer experience where students go from "what is a 3D printer?" to actually designing and printing their own creations. Across 6 fun sessions, you'll learn to set up the printer, fix things when they go wrong, and make objects that are actually useful - all while getting a taste of one of the most exciting technologies around.
</div>

<div class="outcomes">
  <div class="section-title">What You'll Be Able to Do</div>
  <ul>
    <li>Take a design file and print a real 3D object from start to finish.</li>
    <li>Use a 3D printer safely and with confidence.</li>
    <li>Spot what went wrong with a print - and fix it.</li>
    <li>Design a simple object that actually fits and works in real life.</li>
    <li>Pick the right plastic and settings for whatever you want to make.</li>
    <li>Understand how 3D printing fits into today's world of making things.</li>
  </ul>
</div>

<div class="sessions">
  <div class="section-title">What Happens Each Day</div>

  <div class="session">
    <div class="session-header">
      <div class="session-num">1</div>
      <div class="session-title">From Screen to Printer - Getting Your Design Ready</div>
    </div>
    <div class="session-body">
      Learn how a 3D design file gets turned into instructions a printer can follow. We'll tweak settings like speed and layer thickness to see what changes, then kick off our very first print.
    </div>
  </div>

  <div class="session">
    <div class="session-header">
      <div class="session-num">2</div>
      <div class="session-title">Setting Up the Printer - Nailing That First Layer</div>
    </div>
    <div class="session-body">
      Load the plastic, clean the print surface, and get the printer dialled in so that very first layer sticks perfectly. It sounds small, but it makes or breaks the whole print!
    </div>
  </div>

  <div class="session">
    <div class="session-header">
      <div class="session-num">3</div>
      <div class="session-title">Choosing the Right Plastic for the Job</div>
    </div>
    <div class="session-body">
      Not all 3D printing plastics are the same! Discover different types and when to use each one. We'll also look at how the inside structure of a print affects how strong it ends up being.
    </div>
  </div>

  <div class="session">
    <div class="session-header">
      <div class="session-num">4</div>
      <div class="session-title">When Things Go Wrong - Fixing Print Problems</div>
    </div>
    <div class="session-body">
      Every printer hits a snag sometimes. Learn to recognise common problems - corners lifting off, plastic not flowing right, or a blocked tip - and how to fix them quickly without wasting material.
    </div>
  </div>

  <div class="session">
    <div class="session-header">
      <div class="session-num">5</div>
      <div class="session-title">Make Something Useful - Designing for the Real World</div>
    </div>
    <div class="session-body">
      Measure a real object and design something that actually fits it. We'll cover the little tricks - like leaving a tiny bit of extra space - that make 3D-printed parts work properly in the real world.
    </div>
  </div>

  <div class="session">
    <div class="session-header">
      <div class="session-num">6</div>
      <div class="session-title">The Bigger Picture - Where 3D Printing is Headed</div>
    </div>
    <div class="session-body">
      See how 3D printing compares to traditional ways of making things, and explore other types of printers beyond what we've been using. We'll also help you figure out what to look for if you ever want to start printing at home.
    </div>
  </div>

</div>

<div class="footer">
  <span>LayerWeaver 3D Printing Studio · layerweaver.com</span>
  <span>Summer Camp Syllabus 2025</span>
</div>

</body>
</html>`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const outPath = path.join(__dirname, '../workshops/Syllabus_ Introduction to 3D Printing.pdf');
  await page.pdf({
    path: outPath,
    format: 'A4',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    printBackground: true,
  });

  await browser.close();
  console.log('PDF generated:', outPath);
})();
