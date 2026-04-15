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
  .sessions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .session {
    border: 1px solid #e8e0f5;
    border-radius: 6px;
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
  .session-body { padding: 6px 12px 8px; font-size: 9pt; color: #444; }
  .session-body ul { padding-left: 15px; margin-top: 3px; }
  .session-body li { margin-bottom: 1px; }

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
  <div class="sessions-grid">

  <div class="session">
    <div class="session-header">
      <div class="session-num">1</div>
      <div class="session-title">From Screen to Printer - Getting Your Design Ready</div>
    </div>
    <div class="session-body">
      <ul>
        <li>What is a 3D design file and where to find free models online</li>
        <li>Introduction to slicing software (Bambu Studio / Cura)</li>
        <li>Key settings explained: layer height, print speed, infill density</li>
        <li>Generating print instructions and sending them to the printer</li>
        <li>Starting our first print together and understanding what to watch for</li>
      </ul>
    </div>
  </div>

  <div class="session">
    <div class="session-header">
      <div class="session-num">2</div>
      <div class="session-title">Setting Up the Printer - Nailing That First Layer</div>
    </div>
    <div class="session-body">
      <ul>
        <li>Loading and unloading filament correctly</li>
        <li>Cleaning and preparing the build surface</li>
        <li>Manual vs automatic bed leveling - how and when to use each</li>
        <li>Adjusting nozzle height (Z-offset) for a perfect first layer</li>
        <li>Diagnosing and fixing a bad first layer on a live print</li>
      </ul>
    </div>
  </div>

  <div class="session">
    <div class="session-header">
      <div class="session-num">3</div>
      <div class="session-title">Choosing the Right Plastic for the Job</div>
    </div>
    <div class="session-body">
      <ul>
        <li>PLA - the everyday beginner-friendly material</li>
        <li>PETG - stronger, more flexible, and heat-resistant</li>
        <li>Specialty filaments: flexible, glow-in-the-dark, wood-filled, and more</li>
        <li>How infill pattern and wall count affect strength and weight</li>
        <li>Storing filament properly to prevent moisture damage</li>
      </ul>
    </div>
  </div>

  <div class="session">
    <div class="session-header">
      <div class="session-num">4</div>
      <div class="session-title">When Things Go Wrong - Fixing Print Problems</div>
    </div>
    <div class="session-body">
      <ul>
        <li>Identifying and clearing a clogged nozzle</li>
        <li>Fixing warping and poor bed adhesion</li>
        <li>Diagnosing under-extrusion and over-extrusion</li>
        <li>Dealing with stringing, blobs, and layer shifts</li>
        <li>Routine maintenance tasks and printing responsibly to reduce waste</li>
      </ul>
    </div>
  </div>

  <div class="session">
    <div class="session-header">
      <div class="session-num">5</div>
      <div class="session-title">Make Something Useful - Designing for the Real World</div>
    </div>
    <div class="session-body">
      <ul>
        <li>Taking accurate measurements of real objects at home</li>
        <li>Introduction to Fusion 360 - professional design software, free for personal use</li>
        <li>Basic shapes, combining and cutting geometry</li>
        <li>Understanding tolerances - why parts need a little extra clearance</li>
        <li>Exporting your design and slicing it for print</li>
      </ul>
    </div>
  </div>

  <div class="session">
    <div class="session-header">
      <div class="session-num">6</div>
      <div class="session-title">The Bigger Picture - Where 3D Printing is Headed</div>
    </div>
    <div class="session-body">
      <ul>
        <li>FDM vs resin (SLA/MSLA) vs powder (SLS) - what's the difference</li>
        <li>Real-world applications: medical, aerospace, education, consumer products</li>
        <li>How 3D printing compares to traditional manufacturing methods</li>
        <li>Choosing a printer for home use - what to look for and what to spend</li>
        <li>Communities, YouTube channels, and resources to keep learning</li>
      </ul>
    </div>
  </div>

  </div>
</div>

<div class="footer">
  <span>LayerWeaver 3D Printing Studio · layerweaver.com</span>
  <span>Summer Camp Syllabus 2026</span>
</div>

</body>
</html>`;

const htmlWeekend = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #1a1a1a;
    font-size: 10pt;
    line-height: 1.5;
    padding: 30px 40px;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #A083D5;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .brand { font-size: 18pt; font-weight: 800; color: #A083D5; }
  .badge { background: #e8e0f5; color: #6b46c1; font-weight: 700; font-size: 8pt; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.5px; }
  .title-block { margin-bottom: 12px; }
  .title-block h1 { font-size: 15pt; font-weight: 700; margin-bottom: 3px; }
  .title-block p { color: #555; font-size: 9.5pt; }
  .meta { display: flex; gap: 24px; background: #f7f4fe; border-radius: 6px; padding: 10px 16px; margin-bottom: 14px; font-size: 9.5pt; }
  .meta-label { font-weight: 600; color: #A083D5; }
  .description { background: #fffdf0; border-left: 4px solid #EFCF20; padding: 9px 14px; border-radius: 0 6px 6px 0; margin-bottom: 16px; font-size: 10pt; color: #333; }
  .section-title { font-size: 9pt; font-weight: 700; color: #A083D5; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px; }
  .outcomes { margin-bottom: 18px; }
  .outcomes ul { padding-left: 18px; }
  .outcomes li { margin-bottom: 4px; font-size: 10pt; }
  .session { border: 1px solid #e8e0f5; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
  .session-header { background: #f7f4fe; padding: 10px 16px; display: flex; align-items: center; gap: 10px; }
  .day-badge { background: #A083D5; color: #fff; font-weight: 700; font-size: 8.5pt; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }
  .session-title { font-weight: 600; font-size: 10.5pt; color: #1a1a1a; }
  .session-body { padding: 10px 16px 12px; font-size: 10pt; color: #444; }
  .session-body ul { padding-left: 16px; margin-top: 4px; }
  .session-body li { margin-bottom: 2px; }
  .footer { margin-top: 20px; border-top: 1px solid #e8e0f5; padding-top: 10px; display: flex; justify-content: space-between; font-size: 8.5pt; color: #999; }
</style>
</head>
<body>

<div class="header">
  <div class="brand">LayerWeaver</div>
  <div class="badge">ADULTS</div>
</div>

<div class="title-block">
  <h1>Weekend Workshop: 3D Printing Essentials</h1>
  <p>Course Syllabus - Hands-on 3D Printing for Adults, No Experience Needed</p>
</div>

<div class="meta">
  <div><span class="meta-label">Duration:</span> 6 Hours total</div>
  <div><span class="meta-label">Sessions:</span> 2 x 3 Hours</div>
  <div><span class="meta-label">Schedule:</span> Saturday + Sunday</div>
  <div><span class="meta-label">Level:</span> Complete Beginners</div>
</div>

<div class="description">
  A focused weekend crash course for adults who want to understand 3D printing without the fluff. Two practical sessions over a weekend - enough to go from complete beginner to operating a printer, designing your own objects, fixing common issues, and knowing exactly what to do next.
</div>

<div class="outcomes">
  <div class="section-title">What You'll Be Able to Do</div>
  <ul>
    <li>Understand how a 3D printer works and what it can realistically make.</li>
    <li>Set up and operate a printer from scratch.</li>
    <li>Find ready-made designs online and print them.</li>
    <li>Design a simple object from scratch using free software.</li>
    <li>Spot and fix the most common problems you'll run into.</li>
    <li>Decide confidently whether a 3D printer is right for you.</li>
  </ul>
</div>

<div class="sessions">
  <div class="section-title">What Happens Each Day</div>

  <div class="session">
    <div class="session-header">
      <div class="day-badge">Day 1 - Sat</div>
      <div class="session-title">Getting Started - Your First Print</div>
    </div>
    <div class="session-body">
      <ul>
        <li>How FDM 3D printing works - building objects one layer at a time</li>
        <li>What 3D printing can and can't realistically do</li>
        <li>Setting up the printer: loading filament, cleaning the build plate, calibration</li>
        <li>Finding and downloading designs from Thingiverse and Printables</li>
        <li>Slicing a model: key settings explained in plain English</li>
        <li>Watching and understanding your first print as it happens</li>
        <li>PLA vs PETG vs specialty filaments - which to use when</li>
      </ul>
    </div>
  </div>

  <div class="session">
    <div class="session-header">
      <div class="day-badge">Day 2 - Sun</div>
      <div class="session-title">Design It Yourself - From Idea to Printed Object</div>
    </div>
    <div class="session-body">
      <ul>
        <li>Introduction to Fusion 360 - professional design software, free for personal use</li>
        <li>Basic shapes, combining and cutting geometry to make custom parts</li>
        <li>Taking measurements and turning them into a printable design</li>
        <li>Understanding tolerances - why parts need a little extra clearance</li>
        <li>Common print problems: nozzle clogs, warping, stringing - and how to fix them</li>
        <li>Should you buy a printer? What to look for and what to budget</li>
        <li>Communities and resources to keep learning after the workshop</li>
      </ul>
    </div>
  </div>

</div>

<div class="footer">
  <span>LayerWeaver 3D Printing Studio - layerweaver.com</span>
  <span>Weekend Workshop Syllabus 2026</span>
</div>

</body>
</html>`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  // Summer camp syllabus
  let page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const outPath = path.join(__dirname, '../workshops/Syllabus_ Introduction to 3D Printing.pdf');
  await page.pdf({
    path: outPath,
    format: 'A4',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    printBackground: true,
  });
  console.log('PDF generated:', outPath);

  // Weekend adult workshop syllabus
  page = await browser.newPage();
  await page.setContent(htmlWeekend, { waitUntil: 'networkidle0' });

  const outPathWeekend = path.join(__dirname, '../workshops/Syllabus_ Weekend Workshop.pdf');
  await page.pdf({
    path: outPathWeekend,
    format: 'A4',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    printBackground: true,
  });
  console.log('PDF generated:', outPathWeekend);
})();
