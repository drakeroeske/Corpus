# Corpus

**Every rep, meal, and night's sleep — connected.**

Corpus is a science-based training app for the gym. It tells you exactly what to lift each day, adjusts for how well you slept and recovered, and learns from every set. It runs entirely on your phone. There are no accounts and no server: your data stays on your device.

v1 is a prototype. The social features, watch sync and AI coach are simulated with demo data.

---

## Run it on your computer

You need **Node.js** (version 20 or newer) from [nodejs.org](https://nodejs.org).

1. Open a terminal in this folder.
2. Install the app's libraries. You only need to do this once:
   ```bash
   npm install
   ```
3. Start it:
   ```bash
   npm run dev
   ```
4. Open the `Local:` address it prints, usually http://localhost:5173.
   To try it on your phone, connect the phone to the same Wi-Fi and open the `Network:` address instead.

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Runs the unit tests for the training engine |
| `npm run build` | Builds the finished app into the `dist` folder |
| `npm run preview` | Serves that finished build so you can check it |

On the first screen, tap **Skip: load demo** to see every screen filled with 8 weeks of realistic data.

---

## Put it online for free (Vercel)

1. Create a free account at [github.com](https://github.com) and upload this folder as a new repository.
   GitHub Desktop is the easiest way to do this: choose *Add existing repository*, then *Publish*.
2. Create a free account at [vercel.com](https://vercel.com) and sign in with GitHub.
3. Click **Add New → Project** and pick your Corpus repository.
4. Vercel detects Vite automatically: build command `npm run build`, output folder `dist`. Click **Deploy**.
5. After about a minute you get a link like `https://corpus-yourname.vercel.app`. That is your app.

Each time you push changes to GitHub, Vercel updates the site automatically. Netlify works the same way if you prefer it.

---

## Add it to your iPhone home screen

1. Open your Vercel link in **Safari**. It must be Safari, not Chrome.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open Corpus from the new icon. It runs full-screen like a normal app and works offline in the gym.

Your data is stored inside the app on that phone. Use **Profile → Export backup** now and then to save a copy.

---

## Turn on real Spotters (optional)

Out of the box, Spotters uses pretend people. To let real friends follow each other, like and comment, form crews and see who's at the gym, connect a free **Supabase** backend. Training data, check-ins, meals and photos never leave the phone. Only the feed, crews and what you choose under **Profile → Sharing** go online.

1. **Create the project.** Sign up at [supabase.com](https://supabase.com), click **New project**, give it a name and a database password, and pick the region closest to you. Wait about a minute for it to start.
2. **Create the tables.** In the left menu open **SQL Editor → New query**. Paste the entire contents of `supabase/schema.sql` from this folder and click **Run**. It should say "Success".
3. **Let people sign in with a code.** Open **Authentication → Emails → Magic Link**. Add this line to the email body and save:
   ```
   Your Corpus code: {{ .Token }}
   ```
   Codes are needed on iPhone, because an app added to the home screen can't open email links.
4. **Tell Supabase where the app lives.** Open **Authentication → URL Configuration**. Set **Site URL** to your Vercel link. Under **Redirect URLs**, add your Vercel link plus `http://localhost:5173` and `http://localhost:5174`.
5. **Copy your keys.** Open **Project Settings → API** (or **Data API**). Copy the **Project URL** and the **anon public** key. The anon key is meant to be public, because the access rules from step 2 protect the data.
6. **On your computer:** copy `.env.example` to a new file named `.env.local`, then paste the two values after the `=` signs. Restart `npm run dev`.
7. **On Vercel:** open your project → **Settings → Environment Variables**. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values, then **Deployments → Redeploy**.

The Spotters tab now asks for an email and sends a sign-in code. To connect with someone, go to **Find → Share invite link** and send them the link.

Good to know:
- **Email limits:** Supabase's built-in email only sends a few sign-in emails per hour. For more than a handful of testers, add your own email provider under **Authentication → Emails → SMTP settings**.
- **Offline:** workouts, likes and comments made with no signal are queued on the phone and sent automatically when you're back online.
- **Leaving keys empty:** with no keys set, the app stays in simulated mode, and the demo still works.

---

## Where things live (for developers)

```
src/
  engine/      pure training logic + Vitest tests (no React, no storage)
  data/        Dexie database, repositories, exercise library, templates, demo seeder
  services/    simulated watchSync, social and aiCoach behind interfaces
  store/       Zustand app state (rest timer)
  screens/     one folder per tab: today, train, body, spotters, profile, onboarding
  components/  shared UI (buttons, steppers, rings, body map)
  theme/       design tokens
```

The full product spec is in `SPEC.md`, and build progress is in `PROGRESS.md`.
