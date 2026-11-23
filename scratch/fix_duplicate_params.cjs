const fs = require('fs');

let ticket = fs.readFileSync('components/ticket.html', 'utf8');

const targetDuplicate = `            const params = new URLSearchParams(window.location.search);
            let requestedId = (params.get('id') || '').trim();
            if (!requestedId) {
                try {
                    requestedId = (localStorage.getItem('jadoo_current_ticket_id') || '').trim();
                } catch (_) {}
            }`;

const reDuplicate = /\s*const params = new URLSearchParams\(window\.location\.search\);\s*let requestedId = \(params\.get\('id'\) \|\| ''\)\.trim\(\);\s*if \(!requestedId\) \{\s*try \{\s*requestedId = \(localStorage\.getItem\('jadoo_current_ticket_id'\) \|\| ''\)\.trim\(\);\s*\} catch \(_\) \{\}\s*\}/;

if (reDuplicate.test(ticket)) {
  ticket = ticket.replace(reDuplicate, '');
  fs.writeFileSync('components/ticket.html', ticket, 'utf8');
  console.log('Removed duplicate params and requestedId declarations in ticket.html');
} else {
  console.error('Could not match duplicate params in ticket.html');
}
