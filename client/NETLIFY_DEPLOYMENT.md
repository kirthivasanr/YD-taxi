# Deploying to Netlify

## Step 1: Configure Environment Variables in Netlify

After deploying your site to Netlify, you need to add environment variables:

1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Add the following variables:

| Variable Name | Value |
|--------------|-------|
| `VITE_GOOGLE_MAPS_API_KEY` | `AIzaSyCGXDFH4ZuXHD57bIo9t8a6HacWBGHhSuo` |
| `VITE_WHATSAPP_NUMBER` | `919884428627` |
| `VITE_API_URL` | Your backend API URL (e.g., `https://your-backend.herokuapp.com/api`) |

5. After adding the variables, **redeploy** your site (Deploys → Trigger deploy → Deploy site)

## Step 2: Update API URL for Production

Before deploying, make sure to:

1. Deploy your backend server (to Render, Heroku, Railway, etc.)
2. Update `VITE_API_URL` in Netlify environment variables to point to your production backend

## Step 3: Secure Your API Key (Recommended)

⚠️ **Important**: Your Google Maps API key is currently exposed in the client-side code. To secure it:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your API key
4. Under **Application restrictions**:
   - Select "HTTP referrers (web sites)"
   - Add your Netlify domain: `https://your-site-name.netlify.app/*`
   - Add localhost for development: `http://localhost:5173/*`
5. Under **API restrictions**:
   - Select "Restrict key"
   - Enable only: Maps JavaScript API, Places API, Directions API, Geocoding API

## Google Maps Autocomplete Warning

The console warning about `Autocomplete` being deprecated is just informational. The feature still works and will continue to receive bug fixes. You can ignore it for now or migrate to `PlaceAutocompleteElement` later when needed.

## Build Command

Netlify should auto-detect these settings, but if needed:
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Base directory**: `client`

## Common Issues

### Issue: "Missing API Key" error
**Solution**: Make sure you've added `VITE_GOOGLE_MAPS_API_KEY` to Netlify environment variables and redeployed.

### Issue: "Failed to fetch" or CORS errors
**Solution**: Your backend needs to allow CORS from your Netlify domain. Update your backend CORS configuration.

### Issue: Backend not accessible
**Solution**: Make sure `VITE_API_URL` points to your deployed backend URL, not localhost.
