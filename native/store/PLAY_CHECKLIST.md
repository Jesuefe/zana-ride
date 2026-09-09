# Getting Zana onto Google Play

Internal testing is the fastest track — up to 100 testers by email, no review
wait for the first upload. Start there.

## 1. Create the signing key

Do this once, on your own machine. Guard the file: lose it and you can never
update the app under the same identity again.

```
keytool -genkey -v -keystore zana.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias zana
```

It asks for a password and some details. Then encode it for CI:

```
certutil -encode zana.jks zana.txt
```

Open `zana.txt`, remove the BEGIN and END lines, and copy the rest.

## 2. Add four repository secrets

GitHub → Settings → Secrets and variables → Actions → New secret:

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the encoded text from above |
| `ANDROID_KEYSTORE_PASSWORD` | the store password you chose |
| `ANDROID_KEY_ALIAS` | `zana` |
| `ANDROID_KEY_PASSWORD` | the key password you chose |

## 3. Build the bundle

Actions → **Build Android release (AAB)** → Run workflow. Set version name
`1.0.0` and version code `1`. Download the `.aab` from Artifacts.

The version code must increase with every upload. Play rejects a repeat.

## 4. Play Console

Create two apps — Zana and Zana Driver — then for each:

- **Internal testing** → Create release → upload the `.aab`
- Add testers by email address
- Share the opt-in link with them

## 5. What Play asks for before it will publish

| Item | Notes |
|---|---|
| App icon | 512×512 PNG — in this folder |
| Feature graphic | 1024×500 — still needed |
| Screenshots | At least two phone screenshots per app |
| Short description | 80 characters |
| Full description | Up to 4000 characters |
| Privacy policy URL | **Required.** Not optional with location data |
| Data safety form | Declare location, contacts, photos, payments |
| Content rating | Short questionnaire |

## The part that will hold you up

**Background location on the driver app gets extra scrutiny.** Google reviews
it manually and will ask for:

- A written justification of why the app needs location while closed
- **A video** showing the in-app disclosure a rider sees before the permission
  prompt, and the prompt itself
- Confirmation that the app still works if the rider declines

Budget days, not hours, for this one. The customer app does not request
background location and will not face the same review.

You will also need a prominent in-app disclosure before the permission is
requested — a screen saying plainly that Zana collects location in the
background to share the rider's position with customers during a delivery,
shown *before* the system prompt. That is a Play policy requirement, not a
nicety, and its absence is a common rejection.
