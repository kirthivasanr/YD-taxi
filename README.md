# YD TAXI - MERN Stack

Full-stack taxi booking application with MongoDB, Express, React, and Node.js.

## Features

-  Real-time fare estimation
-  Mobile-first responsive design
-  Modern dark + gold theme with animations
-  MongoDB booking storage
-  WhatsApp & Call CTAs
-  Vite for fast dev & HMR

## Tech Stack

**Frontend:**
- React 19 + Vite
- CSS3 with custom animations
- Intersection Observer API

**Backend:**
- Node.js + Express
- MongoDB + Mongoose
- CORS enabled

## Prerequisites

- Node.js v18+ and npm
- MongoDB (local or Atlas)

## Setup

### 1. Install dependencies

```powershell
cd mern-ydtaxi
npm run install-all
```

This installs root, client, and server packages.

### 2. Configure environment

**Server** - Create `server/.env`:

```env
MONGO_URI=mongodb://localhost:27017/ydtaxi
PORT=5000
NODE_ENV=development
WHATSAPP_NUMBER=919080609081
```

**Client** - Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_WHATSAPP_NUMBER=919080609081
```

**For mobile network access**, create `client/.env.local` with your network IP:

```env
VITE_API_URL=http://YOUR_LOCAL_IP:5000/api
VITE_WHATSAPP_NUMBER=919080609081
```

For MongoDB Atlas, use your connection string:
```
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/ydtaxi?retryWrites=true&w=majority
```

### 3. Start MongoDB (if using local)

```powershell
# If MongoDB is installed as a service
net start MongoDB

# Or start manually
mongod --dbpath C:\data\db
```

### 4. Run the app

```powershell
npm run dev
```

This starts:
- **Backend** on http://localhost:5000
- **Frontend** on http://localhost:5173

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bookings` | Create new booking |
| GET | `/api/bookings` | Get all bookings |
| GET | `/api/bookings/:id` | Get booking by ID |
| PATCH | `/api/bookings/:id/status` | Update booking status |
| DELETE | `/api/bookings/:id` | Delete booking |
| GET | `/api/health` | API health check |

## Project Structure

```
mern-ydtaxi/
 client/               # React frontend (Vite)
    src/
       App.jsx      # Main React component
       App.css      # Styles
       main.jsx     # Entry point
    package.json
 server/               # Express backend
    config/
       db.js        # MongoDB connection
    models/
       Booking.js   # Mongoose schema
    routes/
       bookingRoutes.js
    index.js         # Server entry
    .env             # Environment vars
    package.json
 package.json          # Root package with concurrently
 README.md
```

## Scripts

```powershell
# Install all dependencies
npm run install-all

# Run both client & server
npm run dev

# Run only client
npm run client

# Run only server
npm run server

# Build for production
npm run build

# Preview production build
npm run preview
```

## Production Build

```powershell
# Build optimized React app
npm run build

# The client/dist folder can be served by Express or any static host
```

To serve the built React app from Express:
1. Build: `npm run build`
2. Add to `server/index.js`:
```js
import path from 'path';
app.use(express.static(path.join(process.cwd(), '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), '../client/dist/index.html'));
});
```

## Logo

Place your logo at `client/public/logo.png` for it to appear in the header.

## Customization

- **Rates**: Update `rates` object in `client/src/App.jsx`
- **Phone/WhatsApp**: Change numbers in `Header` and `FloatingCTA` components
- **Colors**: Edit CSS variables in `client/src/App.css` under `:root`
- **API URL**: Set `VITE_API_URL` in client env or `.env`

## Troubleshooting

**MongoDB connection error:**
- Ensure MongoDB is running
- Check `MONGO_URI` in `server/.env`

**CORS errors:**
- Backend must run on port 5000 or update `VITE_API_URL`

**Port conflicts:**
- Change `PORT=5000` in `server/.env` for backend
- Vite port can be changed in `client/vite.config.js`

## License

 2025 YD TAXI � All rights reserved.
