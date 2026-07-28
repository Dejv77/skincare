# Péče o pleť

Webová aplikace na sledování denní rutiny péče o pleť. Odškrtávání po jednotlivých krocích, denní stav pleti, dvanáctitýdenní historie a statistiky dodržování.

Funguje **hned po otevření** `index.html` — data se ukládají do prohlížeče. Synchronizace mezi mobilem a počítačem je volitelná, přidává se nastavením Supabase (níže).

## Soubory

| Soubor | Co dělá |
|---|---|
| `index.html` | Kostra a statický obsah protokolu |
| `app.js` | Rozvrh, logika, statistiky, sync — **tady se konfiguruje Supabase** |
| `style.css` | Vzhled |
| `sw.js` | Service worker, offline běh |
| `manifest.json`, `icon.svg` | PWA — přidání na plochu |
| `skincare.html` | Původní statický list, ponechán pro tisk |

## Jak se používá

**Dnes** — dnešní ráno a večer podle aktuální fáze. Odškrtáváš kroky, dole označíš holení, stav pleti a poznámku. U retinalových večerů je u kroku „Čekej 20 min" tlačítko s odpočtem. Šipkami se dá vrátit do minulých dnů a doplnit je zpětně.

**Holení** není jen štítek — mění rutinu:

- **Ráno** → v seznamu kroků se Sisleÿum automaticky nahradí za Apaisante Réparatrice. Odškrtnutí zůstává, i když příznak přepneš (krok si drží stejné `id`).
- **Večer** → pokud na ten den vychází retinal, appka to červeně připomene. Bariéra je po holení porušená, retinal patří jinam.

V historii se holení počítá a v kalendáři je vidět jako fialový proužek na levém okraji políčka. Když se ti stane, že si dáš retinal po večerním holení, objeví se statistika **Kolize** — přesně ta věc, kterou chceš po pár týdnech vidět, když pleť zlobí.

**Historie** — čtyři statistiky, kalendářová mřížka za 12 týdnů a seznam nejčastěji vynechaných kroků. Kliknutí na políčko v kalendáři otevře ten den. Zelené = vše splněno, oranžové = částečně, tečka v rohu = zaznamenaný stav pleti, oranžový rámeček = retinalový den.

**Protokol** — přepínač fází, celý rozvrh, pravidla a poznámky. Změna fáze platí od dneška dopředu; minulé dny si drží fázi, ve které skutečně byly, takže se historie zpětně nepřepíše.

## Nasazení na GitHub Pages

Repozitář už běží na <https://dejv77.github.io/skincare/>. Změny se nasadí samy po pushnutí:

```bash
git add .
git commit -m "Popis změny"
git push
```

Na mobilu otevři tu adresu a dej **Sdílet → Přidat na plochu**. Otevírá se pak jako aplikace, bez adresního řádku.

Po každé změně souborů zvyš `CACHE` v `sw.js` (`skincare-v2` → `v3`), jinak si prohlížeč může držet starou verzi.

Repozitář může být klidně veřejný — je v něm jen kód, žádná data. Ta jsou v prohlížeči, případně v Supabase za přihlášením.

## Synchronizace přes Supabase

**Hotovo a zapnuté** — projekt `skincare` (`xaoihcfkwjlzupwbnhbx`, Frankfurt). Účet `martinek.d@gmail.com` už existuje; přihlas se **e-mailem a heslem** v appce → **Protokol → Synchronizace**. Heslo si tam pod „Změnit heslo" rovnou nastav vlastní.

Přihlášení odkazem v e-mailu zůstává jako záloha (schované pod rozbalovátkem), ale free tier pošle jen dva maily za hodinu — heslo je spolehlivější.

Ověřeno naostro:

- nepřihlášený nepřečte nic a zápis dostane `42501 row-level security`
- přihlášený vidí jen svůj řádek, i když se zeptá na celou tabulku
- pokus přepsat cizí data změní nula řádků

Publishable klíč (`sb_publishable_…`) v `app.js` je určený do prohlížeče a smí být ve veřejném repozitáři. **Secret klíč** (`sb_secret_…`) do kódu nikdy nepatří — obchází RLS.

Postup níže je záznam toho, co bylo nastaveno, kdyby to bylo potřeba zopakovat.

### 1. Založ projekt

Na [supabase.com](https://supabase.com) → přihlas se přes GitHub → **New project**.

- **Name:** `skincare`
- **Database Password:** vygeneruj a ulož do správce hesel (potřebuješ ho jen při přímém přístupu k DB, appka ho nepoužívá)
- **Region:** `Central EU (Frankfurt)`
- **Plan:** Free

Založení trvá asi minutu.

### 2. Vytvoř tabulku

V **SQL Editor** spusť:

```sql
create table skincare_state (
  user_id uuid primary key references auth.users on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table skincare_state enable row level security;

-- Každý vidí a mění jen svůj řádek.
create policy "vlastni data" on skincare_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Row level security je to podstatné — bez ní by anon klíč v kódu umožnil číst data komukoli.

### 3. Povol adresu appky

**Authentication → URL Configuration:**

- **Site URL:** `https://dejv77.github.io/skincare/`
- **Redirect URLs** → Add URL: `https://dejv77.github.io/skincare/`

Bez toho přihlašovací odkaz z e-mailu skončí na chybové stránce.

### 4. Doplň klíče do kódu

**Settings → API Keys**, zkopíruj `Project URL` a `anon public` klíč do prvních řádků `app.js`:

```js
const SUPABASE_URL = "https://xxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbG...";
```

Pak `git add . && git commit -m "Zapnout synchronizaci" && git push`.

Anon klíč je určený do prohlížeče, veřejný repozitář mu nevadí — chrání ho RLS politika z kroku 2. `service_role` klíč do kódu **nikdy** nepatří; ten obchází všechna pravidla.

### 5. Přihlas se

Otevři <https://dejv77.github.io/skincare/> → **Protokol → Synchronizace**, zadej e-mail. Přijde odkaz, po kliknutí jsi přihlášen a odznak vpravo nahoře přepne na „Synchronizováno". Totéž na mobilu a historie se slučuje.

Free tier Supabase pozastaví projekt po týdnu úplné nečinnosti — u appky, kterou otevíráš denně, to nenastane. Obnovíš ho jedním kliknutím v dashboardu.

### Limit odesílaných e-mailů

Vestavěný mailer na free tieru zvládne jen **pár přihlašovacích e-mailů za hodinu**. Na běžné použití to stačí — přihlásíš se jednou na počítači, jednou na mobilu, a session pak drží měsíce. Když ale během chvíle zkusíš přihlášení víckrát, Supabase vrátí `email rate limit exceeded` a musíš počkat. Není to chyba appky.

Kdyby to začalo vadit, jde v **Authentication → Emails → SMTP Settings** připojit vlastní SMTP (Resend, Postmark) a limit zmizí.

Slučování jede po dnech — vyhrává novější záznam. Když si tedy ráno odškrtneš na mobilu a večer na počítači, obojí se zachová.

## Záloha

**Protokol → Záloha dat → Exportovat** stáhne celou historii jako JSON. Import ji sloučí zpět. Dělej to občas i se zapnutým Supabase.

## Fázování retinalu

| Fáze | Týden | Retinalové večery |
|---|---|---|
| 1 | 1–2 | Út, Pá |
| 2 | 3–4 | Po, St, Pá |
| 3 | 5+ | Po–Pá + Ne |

Fáze se přepíná ručně v záložce Protokol — appka ji nezvyšuje sama, protože posun závisí na tom, jak pleť reaguje, ne na kalendáři. Ve fázi 2 ubývá peeling na jednou za čtrnáct dní, ve fázi 3 vypadává; sobota zůstává jediný večer bez retinalu.

## Úpravy rozvrhu

Všechno je v `app.js` nahoře: `PRODUCTS` (názvy), `MORNING` (ranní kroky), `EVENING_TEMPLATES` (typy večerů), `PHASES` (které večery kdy). Přidání kroku znamená přidat řádek — zbytek se dopočítá, včetně statistik.

Kroky mají stabilní `id`. Když ho změníš, historická odškrtnutí toho kroku se rozpojí, takže radši měň jen `name` a `note`.

Po každé změně souborů zvyš `CACHE` v `sw.js` (`skincare-v1` → `v2`), jinak si mobil může držet starou verzi.
