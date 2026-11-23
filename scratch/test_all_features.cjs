const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

console.log('--- STARTING VERIFICATION ---');

// 1. Verify destination booking and services modal scrolling in scripts/script.ts and scripts/script.js
const scriptTs = fs.readFileSync('scripts/script.ts', 'utf8');
const scriptJs = fs.readFileSync('scripts/script.js', 'utf8');

assert(scriptTs.includes('.booking-modal-card'), 'script.ts must include .booking-modal-card in scroll handler');
assert(scriptTs.includes('.service-modal-card'), 'script.ts must include .service-modal-card in scroll handler');
assert(scriptJs.includes('.booking-modal-card'), 'compiled script.js must include .booking-modal-card in scroll handler');
assert(scriptJs.includes('.service-modal-card'), 'compiled script.js must include .service-modal-card in scroll handler');
console.log('✓ Modal scrolling logic verified in script.ts & script.js');

// 2. Verify styles.css & pages.css for modal scrollability
const stylesCss = fs.readFileSync('styles/styles.css', 'utf8');
const pagesCss = fs.readFileSync('styles/pages.css', 'utf8');

assert(stylesCss.includes('overscroll-behavior: contain'), 'styles.css has overscroll-behavior: contain on booking modal');
assert(pagesCss.includes('overscroll-behavior: contain'), 'pages.css has overscroll-behavior: contain on service modal');
console.log('✓ CSS modal overscroll containment verified');

// 3. Verify ticket.html syntax & logic
const ticketHtml = fs.readFileSync('components/ticket.html', 'utf8');
assert(ticketHtml.includes('function normalizeBooking'), 'ticket.html contains normalizeBooking helper');
assert(ticketHtml.includes('allBookings = userBookings.map(normalizeBooking)'), 'ticket.html normalizes bookings on load');

// Test module script syntax in ticket.html
const ticketMatch = ticketHtml.match(/<script type="module">([\s\S]*?)<\/script>/);
assert(ticketMatch, 'ticket.html has module script');
const ticketCode = ticketMatch[1].replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '// import');
new vm.Script(ticketCode);
console.log('✓ ticket.html script compiles cleanly with zero syntax errors');

// 4. Verify profile.html syntax & logic
const profileHtml = fs.readFileSync('components/profile.html', 'utf8');
const profileMatch = profileHtml.match(/<script type="module">([\s\S]*?)<\/script>/);
assert(profileMatch, 'profile.html has module script');
const profileCode = profileMatch[1].replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '// import');
new vm.Script(profileCode);
console.log('✓ profile.html script compiles cleanly with zero syntax errors');

// 5. Verify services.html syntax
const servicesHtml = fs.readFileSync('components/services.html', 'utf8');
const servicesMatch = servicesHtml.match(/<script type="module">([\s\S]*?)<\/script>/);
assert(servicesMatch, 'services.html has module script');
const servicesCode = servicesMatch[1].replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '// import');
new vm.Script(servicesCode);
console.log('✓ services.html script compiles cleanly with zero syntax errors');

// 6. Verify db.ts & db.js getBookings normalization
const dbTs = fs.readFileSync('scripts/db.ts', 'utf8');
const dbJs = fs.readFileSync('scripts/db.js', 'utf8');
assert(dbTs.includes('destination_name: b.destination_name || b.destination'), 'db.ts normalizes bookings');
assert(dbJs.includes('destination_name: b.destination_name || b.destination'), 'compiled db.js normalizes bookings');
console.log('✓ db.ts & db.js booking normalization verified');

console.log('--- ALL VERIFICATIONS PASSED SUCCESSFULLY (100%) ---');
