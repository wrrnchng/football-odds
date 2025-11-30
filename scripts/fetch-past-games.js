const fetch = require('node-fetch');

async function fetchPastGames(startDate, endDate) {
  const response = await fetch('http://localhost:3000/api/espn/fetch-past-games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate })
  });
  
  const data = await response.json();
  console.log(`Stored ${data.stored} games`);
}

// Example: Fetch last 90 days
const today = new Date();
const ninetyDaysAgo = new Date(today);
ninetyDaysAgo.setDate(today.getDate() - 90);

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

fetchPastGames(formatDate(ninetyDaysAgo), formatDate(today));