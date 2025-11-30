# Football Odds - Soccer Match Data & Analytics Platform

A comprehensive Next.js application for tracking soccer matches, team statistics, player data, and head-to-head comparisons. The platform automatically fetches match data and provides a modern, interactive dashboard for analyzing football statistics.

## 🚀 Features

- **Live Match Dashboard**: View upcoming and recent matches across all major leagues
- **Team Analytics**: 
  - Team statistics (wins, draws, losses, goals)
  - Recent matches history (last 10 matches)
  - Head-to-head comparisons with last 5 matches between teams
  - League-based team filtering
- **Player Statistics**: Detailed player performance data
- **Auto-Fetch System**: Automatically fetches upcoming games (today + 7 days) and past games on server startup
- **League Management**: Support for major leagues including:
  - Premier League (England)
  - La Liga (Spain)
  - Bundesliga (Germany)
  - Serie A (Italy)
  - Ligue 1 & Ligue 2 (France)
  - Liga Professional (Argentina)
  - And many more

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or **pnpm**
- **Git** - [Download](https://git-scm.com/)

## 🛠️ Installation

### Option 1: Quick Start (Windows)

1. Double-click `startup.bat` to automatically set up and start the application
2. The script will:
   - Check for Node.js installation
   - Install dependencies
   - Initialize the database
   - Start the development server

### Option 2: Manual Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd football-odds
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the database**
   ```bash
   npm run db:push
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📜 Available Scripts

### Development
- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint

### Database Management
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema changes to database (creates tables)
- `npm run db:populate` - Populate database with sample data
- `npm run db:fetch-past-year` - Fetch games from the past year (long-running script)
- `npm run db:diagnose` - Diagnose missing matches in the database
- `npm run db:check-leagues` - Check team league assignments

## 🏗️ Project Structure

```
football-odds/
├── frontend/
│   ├── app/                    # Next.js app directory
│   │   ├── api/               # API routes
│   │   ├── page.tsx           # Main dashboard page
│   │   └── layout.tsx          # Root layout
│   ├── components/            # React components
│   │   ├── dashboard.tsx      # Main dashboard component
│   │   ├── teams.tsx          # Teams page component
│   │   ├── players.tsx        # Players page component
│   │   └── ui/               # UI component library
│   ├── db/                    # Database configuration
│   │   ├── index.ts          # Database connection
│   │   └── schema.ts         # Database schema
│   ├── lib/                   # Utility libraries
│   │   ├── db/               # Database operations
│   │   ├── services/         # Business logic services
│   │   └── types/            # TypeScript type definitions
│   ├── scripts/               # Utility scripts
│   │   ├── fetch-past-year.ts    # Fetch past year of games
│   │   ├── diagnose-missing-matches.ts
│   │   └── check-team-leagues.ts
│   ├── instrumentation.ts    # Server startup hook
│   └── package.json          # Dependencies and scripts
└── README.md                 # This file
```

## 🔧 Configuration

### Database
The application uses SQLite with Drizzle ORM. The database file (`football-odds.db`) is automatically created in the `frontend` directory on first run.

### Auto-Fetch Configuration
The application automatically fetches:
- **Upcoming games**: Today + next 7 days
- **Past games**: From the latest match in database up to today

This happens automatically on server startup via the `instrumentation.ts` hook.

## 📊 Data Sources

The application fetches match data, scores, team information, and player statistics from external data sources. Data is automatically synchronized on server startup and can be manually updated using the provided scripts.

## 🚀 Deployment

### Important Notes for Vercel Deployment

⚠️ **This application uses SQLite, which is not compatible with Vercel's serverless environment.**

For Vercel deployment, you'll need to:
1. Migrate to a cloud database (PostgreSQL, MySQL, etc.)
2. Update database connection in `frontend/db/index.ts`
3. Consider converting long-running scripts to API routes with pagination

### Alternative Deployment Options
- **Railway**: Supports SQLite and long-running processes
- **Render**: Supports persistent file systems
- **Fly.io**: Good for containerized deployments
- **Traditional VPS**: Full control over the environment

## 🧪 Development Tips

1. **First Run**: The database will be empty. The auto-fetch will populate it on startup, but this may take a few minutes.

2. **Fetching Historical Data**: Use `npm run db:fetch-past-year` to fetch a full year of historical data. This is a long-running script (can take hours) and should be run locally.

3. **Database Reset**: Delete `football-odds.db` and restart the server to reset the database.

4. **Rate Limiting**: The scripts include rate limiting to avoid overwhelming external APIs. The default is 200ms between requests.

## 🐛 Troubleshooting

### Database Issues
- If you see database errors, try running `npm run db:push` to recreate tables
- Ensure the `frontend` directory has write permissions for the database file

### Port Already in Use
- Change the port: `npm run dev -- -p 3001`
- Or kill the process using port 3000

### Module Not Found Errors
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

### Auto-Fetch Not Working
- Check server console logs for errors
- Verify internet connection
- Ensure external data sources are accessible

## 📝 License

This project is private and proprietary.

## 🤝 Contributing

This is a private project. For contributions, please contact the repository maintainer.

## 📞 Support

For issues or questions, please open an issue in the repository.

---

**Built with:**
- Next.js 16
- React 19
- TypeScript
- Drizzle ORM
- SQLite
- Tailwind CSS
- Radix UI

