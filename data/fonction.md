# RodiumAi Sites — Spécification technique du backend unifié

Version 1.0. Document d'implémentation. Toutes les décisions ci-dessous sont fixées, pas optionnelles.

---

## 0. Vocabulaire et périmètre

| Terme             | Définition                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| **Builder**       | L'application RodiumAi qui génère les sites (dashboard Next.js + agent).                                |
| **Site**          | Un projet généré par un utilisateur. React + Vite, SPA statique.                                        |
| **Owner**         | L'utilisateur RodiumAi propriétaire du site. Il a un wallet RODI.                                       |
| **End-user**      | Un visiteur authentifié du site généré. Il n'a pas de compte RodiumAi.                                  |
| **Sites Gateway** | Le backend unifié multi-tenant décrit dans ce document. Service FastAPI.                                |
| **Connector**     | Un compte tiers rattaché à un compte owner (Supabase, Firebase, Cloudinary, Resend, FedaPay, RodiumAi). |
| **Capability**    | Une famille de fonctions backend : `data`, `auth`, `storage`, `email`, `payment`, `ai`.                 |
| **Adapter**       | L'implémentation d'une capability pour un connector donné.                                              |

### Principes non négociables

1. **Aucun secret dans le bundle client.** Le site généré ne contient qu'une clé publiable liée à l'origine. Toutes les credentials de connectors vivent chiffrées côté Sites Gateway.
2. **Le site ne parle jamais directement à un tiers.** Pas d'appel direct à Supabase, Firebase, Resend, Cloudinary ou FedaPay depuis le navigateur. Tout passe par `forgeapi.rodiumai.com` mais en local ca sera du localhost .
3. **Surface de dépendances figée.** Aucun `npm install` arbitraire. Le manifeste du runtime est versionné et géré par RodiumAi.
4. **Deny by default.** Toute opération data est refusée sauf policy explicite. Aucune exception.
5. **Pas de code serveur arbitraire en v1.** Le site n'exécute pas de logique custom côté serveur. Il consomme des opérations typées et déclaratives.
6. **Toute opération est mesurée et facturée en RODI** sur le wallet de l'owner.

### Hors périmètre v1

- Export d'un site avec son backend. L'export produit soit un site statique pur, soit un site qui continue à appeler `forgeapi.rodiumai.com` mais en local ca sera du localhost . Voir section 14.
- Server-side rendering. Les sites sont des SPA.
- Fonctions serverless écrites par l'utilisateur. Prévu v2, section 16.

---

## 1. Vue d'ensemble

```
Navigateur (site généré, SPA React+Vite)
  │  @rodiumai/site-sdk
  │  Authorization: Bearer <site_publishable_key>
  │  X-Rodium-Session: <end_user_jwt>   (optionnel)
  ▼
Cloudflare Worker de routage  (résolution host → site_id, CORS, rate limit L1)
  ▼
Sites Gateway  (FastAPI, ECS Fargate, eu-west-1)
  ├─ AuthN de la clé de site       → Redis cache
  ├─ AuthN de l'end-user           → JWT vérifié
  ├─ Résolution capability→adapter → Redis cache
  ├─ Policy engine                 → deny by default
  ├─ Quota + rate limit L2         → Redis
  ├─ Déchiffrement credential      → KMS envelope, cache mémoire TTL 300s
  ├─ Appel adapter                 → Supabase / Firebase / Resend / Cloudinary / FedaPay / RodiumAi
  └─ Émission d'un usage event     → Redis Stream `sites:usage`
       ▼
   Billing worker (NestJS existant) → débit wallet RODI + WalletLedger
```

Le Sites Gateway est un service **distinct** de `api.rodiumai.io` (gateway IA) et de `rsb.rodiumai.io` (backend plateforme). Il partage la même base de données pour les wallets via le worker de billing, mais possède sa propre base opérationnelle.

---

## 2. Domaines et endpoints

| Host                                                       | Rôle                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `forgeapi.rodiumai.com` mais en local ca sera du localhost | Sites Gateway. API consommée par les sites générés.                                 |
| `*.rodiumsites.io`                                         | Sous-domaines des sites publiés (assets statiques via CDN).                         |
| `api.rodiumai.io`                                          | Gateway IA existant. Le Sites Gateway l'appelle en interne pour la capability `ai`. |
| `rsb.rodiumai.io`                                          | Backend plateforme existant. Gère wallets, comptes, connectors.                     |

Toutes les routes du Sites Gateway sont préfixées par `/v1`.

---

## 3. Modèle de données du control plane

Base dédiée `rodium_sites` (PostgreSQL 16, Aurora). Toutes les clés primaires sont des UUID v7.

### 3.1 Sites

```sql
CREATE TABLE site (
  id             UUID PRIMARY KEY,
  owner_user_id  UUID NOT NULL,
  org_id         UUID,
  slug           TEXT NOT NULL UNIQUE,          -- ex: "boutique-kossi"
  name           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft', -- draft | published | suspended | deleted
  plan_tier      TEXT NOT NULL DEFAULT 'free',  -- free | pro | team
  runtime_version TEXT NOT NULL,                -- ex: "1.4.0", voir section 11
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspended_reason TEXT
);

CREATE TABLE site_domain (
  id            UUID PRIMARY KEY,
  site_id       UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  hostname      TEXT NOT NULL UNIQUE,           -- boutique-kossi.rodiumsites.io | shop.kossi.tg
  kind          TEXT NOT NULL,                  -- system | custom
  tls_status    TEXT NOT NULL DEFAULT 'pending',-- pending | active | failed
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON site_domain (site_id);
```

`hostname` est la clé de résolution utilisée par le worker de routage et par le contrôle CORS.

### 3.2 Clés de site

Deux types de clés, jamais interchangeables.

```sql
CREATE TABLE site_key (
  id            UUID PRIMARY KEY,
  site_id       UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,                  -- publishable | server
  prefix        TEXT NOT NULL,                  -- rds_pub_ | rds_srv_
  last4         TEXT NOT NULL,
  secret_sha256 BYTEA NOT NULL,
  environment   TEXT NOT NULL,                  -- preview | live
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON site_key (secret_sha256);
```

| Type        | Format                           | Emplacement                                                    | Privilèges                                                                                               |
| ----------- | -------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Publishable | `rds_pub_live_<26 chars base58>` | Bundle client du site                                          | Soumise aux policies. Liée à l'origine. Ne peut jamais lire une credential ni faire une opération admin. |
| Server      | `rds_srv_live_<40 chars base58>` | Jamais exposée. Usage builder et automations owner uniquement. | Bypass des policies. Accès admin au site.                                                                |

La clé publiable est **liée à l'origine** : le gateway rejette toute requête dont l'en-tête `Origin` n'appartient pas à `site_domain` du site, sauf en environnement `preview` où `https://*.rodiumai.io` et `http://localhost:*` sont ajoutés à l'allowlist.

### 3.3 Connectors

Les credentials appartiennent au **compte owner**, pas au site. Un utilisateur connecte Cloudinary une fois et l'attache à N sites.

```sql
CREATE TABLE connector_account (
  id             UUID PRIMARY KEY,
  owner_user_id  UUID NOT NULL,
  provider       TEXT NOT NULL,     -- supabase | firebase | cloudinary | resend | fedapay | rodiumai | s3
  label          TEXT NOT NULL,     -- "Supabase prod", affiché à l'utilisateur
  status         TEXT NOT NULL DEFAULT 'active', -- active | invalid | revoked
  dek_encrypted  BYTEA NOT NULL,    -- data key chiffrée par KMS
  payload_cipher BYTEA NOT NULL,    -- credentials JSON chiffrées AES-256-GCM par la DEK
  payload_nonce  BYTEA NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}',  -- données NON sensibles: project_ref, cloud_name, region
  last_checked_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON connector_account (owner_user_id, provider);

CREATE TABLE site_binding (
  id            UUID PRIMARY KEY,
  site_id       UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  capability    TEXT NOT NULL,      -- data | auth | storage | email | payment | ai
  connector_id  UUID REFERENCES connector_account(id),  -- NULL = rodium_managed
  environment   TEXT NOT NULL,      -- preview | live
  config        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON site_binding (site_id, capability, environment);
```

**Règle stricte : une capability, un binding, par environnement.** Un site ne peut pas avoir Supabase et Firebase simultanément pour `data`. Si aucun binding n'existe, le fallback est `rodium_managed`.

### 3.4 Chiffrement des credentials

Enveloppe KMS, sans exception.

1. À la création du connector : `kms.GenerateDataKey(KeyId=RODIUM_SITES_CMK, KeySpec=AES_256)`.
2. Chiffrer le JSON des credentials en AES-256-GCM avec la DEK en clair. AAD = `connector_account.id`.
3. Stocker `CiphertextBlob` dans `dek_encrypted`, le ciphertext dans `payload_cipher`, le nonce dans `payload_nonce`.
4. Effacer la DEK en clair de la mémoire.

Au déchiffrement : `kms.Decrypt` puis cache mémoire process de la DEK, clé = `connector_id`, TTL 300 secondes, taille max 5000 entrées, éviction LRU. La DEK ne va **jamais** dans Redis.

Les credentials déchiffrées ne sont **jamais** loguées, jamais renvoyées par une API, jamais incluses dans un message d'erreur. Le gateway maintient une liste de champs sensibles redaction-forcée dans le logger.

### 3.5 Schéma de données des sites

Le modèle de données du site généré est déclaré dans le control plane. C'est la source de vérité, pas le code généré.

```sql
CREATE TABLE site_collection (
  id            UUID PRIMARY KEY,
  site_id       UUID NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,     -- "posts", "products", snake_case, [a-z][a-z0-9_]{0,62}
  schema        JSONB NOT NULL,    -- JSON Schema draft 2020-12, voir 3.6
  policies      JSONB NOT NULL,    -- voir section 7
  version       INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON site_collection (site_id, name);
```

### 3.6 Format de schéma d'une collection

```json
{
  "fields": {
    "title": { "type": "string", "required": true, "maxLength": 200 },
    "body": { "type": "text", "required": false },
    "price": { "type": "number", "min": 0 },
    "published": { "type": "boolean", "default": false },
    "author_id": { "type": "ref", "collection": "_users" },
    "cover": { "type": "file", "accept": ["image/*"], "maxBytes": 5242880 },
    "tags": { "type": "string[]" },
    "created_at": { "type": "datetime", "auto": "on_create" },
    "updated_at": { "type": "datetime", "auto": "on_update" }
  },
  "indexes": [
    { "fields": ["published", "created_at"] },
    { "fields": ["author_id"] }
  ]
}
```

Types autorisés, liste fermée : `string`, `text`, `number`, `integer`, `boolean`, `datetime`, `date`, `json`, `ref`, `file`, et les variantes tableau `string[]`, `number[]`, `ref[]`.

Champs système injectés automatiquement dans toute collection, non déclarables par l'utilisateur : `id` (UUID v7), `created_at`, `updated_at`.

La collection `_users` est réservée et gérée par la capability `auth`.

---

## 4. Stockage de données par défaut (`rodium_managed`)

Quand aucun connector `data` n'est attaché, les données vivent dans un cluster Aurora partagé.

**Décision : table unique partitionnée, pas un schéma par site.** À 50 000 sites, 50 000 schémas Postgres provoquent un gonflement du catalogue, des `pg_dump` ingérables et une dégradation du planificateur. Le modèle retenu :

```sql
CREATE TABLE site_record (
  site_id     UUID        NOT NULL,
  collection  TEXT        NOT NULL,
  id          UUID        NOT NULL,
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  PRIMARY KEY (site_id, collection, id)
) PARTITION BY HASH (site_id);

-- 64 partitions
-- CREATE TABLE site_record_p00 PARTITION OF site_record FOR VALUES WITH (MODULUS 64, REMAINDER 0);
-- ... jusqu'à p63

CREATE INDEX ON site_record (site_id, collection, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ON site_record USING GIN (data jsonb_path_ops);
```

Les index déclarés dans `site_collection.schema.indexes` sont matérialisés par des index d'expression partiels créés à la demande, plafonnés à 5 par collection :

```sql
CREATE INDEX CONCURRENTLY idx_<site_short>_<collection>_<n>
  ON site_record ((data->>'author_id'))
  WHERE site_id = '<uuid>' AND collection = 'posts';
```

**Soft delete obligatoire.** `deleted_at` est positionné, la ligne n'est jamais supprimée en ligne. Un job de purge quotidien efface les enregistrements `deleted_at < now() - 30 days`.

**Quotas `rodium_managed` par site** : voir section 12.

Quand un site dépasse ses quotas, le gateway retourne `SITE_DATA_QUOTA_EXCEEDED` et propose la migration vers un connector Supabase de l'utilisateur.

---

## 5. Architecture des adapters

Interface commune par capability. Toute nouvelle intégration implémente une interface existante, jamais une route dédiée.

### 5.1 DataAdapter

```python
class DataAdapter(Protocol):
    async def list(self, ctx: SiteContext, collection: str, q: ListQuery) -> Page: ...
    async def get(self, ctx: SiteContext, collection: str, rid: str) -> dict | None: ...
    async def insert(self, ctx: SiteContext, collection: str, payload: dict) -> dict: ...
    async def update(self, ctx: SiteContext, collection: str, rid: str, patch: dict) -> dict: ...
    async def delete(self, ctx: SiteContext, collection: str, rid: str) -> None: ...
    async def count(self, ctx: SiteContext, collection: str, q: ListQuery) -> int: ...
    async def migrate(self, ctx: SiteContext, collection: str, schema: dict) -> None: ...
```

Implémentations v1 : `RodiumManagedData` (Aurora), `SupabaseData` (PostgREST via service role), `FirestoreData` (Firebase Admin SDK).

### 5.2 AuthAdapter

```python
class AuthAdapter(Protocol):
    async def register(self, ctx, email, password) -> EndUser: ...
    async def login(self, ctx, email, password) -> Session: ...
    async def send_otp(self, ctx, email) -> None: ...
    async def verify_otp(self, ctx, email, code) -> Session: ...
    async def oauth_url(self, ctx, provider, redirect_uri) -> str: ...
    async def oauth_callback(self, ctx, provider, code) -> Session: ...
    async def refresh(self, ctx, refresh_token) -> Session: ...
    async def logout(self, ctx, refresh_token) -> None: ...
    async def get_user(self, ctx, user_id) -> EndUser | None: ...
    async def update_user(self, ctx, user_id, patch) -> EndUser: ...
```

Implémentations v1 : `RodiumManagedAuth`, `SupabaseAuth`, `FirebaseAuth`.

### 5.3 StorageAdapter

```python
class StorageAdapter(Protocol):
    async def presign_upload(self, ctx, path, content_type, max_bytes) -> UploadTicket: ...
    async def finalize_upload(self, ctx, ticket_id) -> StoredFile: ...
    async def delete(self, ctx, path) -> None: ...
    async def public_url(self, ctx, path, transform: dict | None) -> str: ...
```

Implémentations v1 : `CloudinaryStorage`, `S3Storage`, `SupabaseStorage`, `RodiumManagedStorage` (R2).

Le paramètre `transform` n'est honoré que par Cloudinary. Ailleurs il est ignoré silencieusement, sans erreur.

### 5.4 EmailAdapter

```python
class EmailAdapter(Protocol):
    async def send(self, ctx, to: list[str], template: str, vars: dict) -> MessageRef: ...
    async def status(self, ctx, message_id) -> DeliveryStatus: ...
```

Implémentation v1 : `ResendEmail`, `RodiumManagedEmail` (SES).

**Contrainte anti-abus critique.** Le site ne peut pas envoyer d'email à une adresse arbitraire avec un corps arbitraire. Deux modes seulement :

- `template` doit correspondre à un template déclaré dans le site et validé au build. Les variables sont substituées côté serveur.
- Le destinataire doit être soit l'end-user authentifié, soit une adresse figurant dans l'allowlist `site_binding.config.allowed_recipients` (les adresses de l'owner, typiquement pour un formulaire de contact).

Toute autre combinaison retourne `EMAIL_RECIPIENT_NOT_ALLOWED`. Sans cette règle, la plateforme devient un relais de spam en quelques jours.

### 5.5 PaymentAdapter

```python
class PaymentAdapter(Protocol):
    async def create_intent(self, ctx, amount, currency, metadata, idem_key) -> PaymentIntent: ...
    async def get_intent(self, ctx, intent_id) -> PaymentIntent: ...
    async def handle_webhook(self, ctx, raw_body, headers) -> WebhookEvent: ...
    async def refund(self, ctx, intent_id, amount) -> Refund: ...
```

Implémentation v1 : `FedaPayPayment`. Prévu : `PayDunya`, `CinetPay`, `Stripe`.

**Le montant n'est jamais transmis par le client.** Le client envoie un `cart` (liste de `{collection, record_id, quantity}`). Le gateway recalcule le montant côté serveur à partir des enregistrements réels. Un client qui envoie `amount` reçoit `PAYMENT_AMOUNT_NOT_ACCEPTED`.

### 5.6 AiAdapter

```python
class AiAdapter(Protocol):
    async def chat(self, ctx, messages, model, params) -> AiResponse: ...
    async def embed(self, ctx, inputs, model) -> list[list[float]]: ...
```

Implémentation v1 : `RodiumAiGateway`, qui appelle `https://api.rodiumai.io/v1/chat/completions` avec une clé de service interne, et attribue la consommation au wallet de l'owner du site via l'en-tête `X-Rodium-Attribute-To`.

**Contraintes.** Le slug de modèle est restreint à une allowlist définie dans `site_binding.config.allowed_models`. Par défaut : `["auto", "fast"]`. Le `system` prompt est stocké côté serveur dans une **AI action** déclarée au build, le client ne fournit que les variables. Cela empêche un visiteur de transformer le site en proxy LLM gratuit.

```json
{
  "actions": {
    "support_bot": {
      "model": "auto",
      "system": "Tu es l'assistant de la boutique {{shop_name}}. Réponds en français.",
      "max_tokens": 500,
      "vars": ["shop_name"],
      "rate_limit": { "per_end_user_per_hour": 20 }
    }
  }
}
```

Appel client : `POST /v1/ai/actions/support_bot` avec `{ "input": "...", "vars": { "shop_name": "Kossi Store" } }`.

---

## 6. Surface d'API du Sites Gateway

Toutes les routes acceptent une clé publiable sauf mention `[server]`.

### 6.1 Data

```
GET    /v1/data/{collection}
GET    /v1/data/{collection}/{id}
POST   /v1/data/{collection}
PATCH  /v1/data/{collection}/{id}
DELETE /v1/data/{collection}/{id}
POST   /v1/data/{collection}/count
```

Paramètres de `GET /v1/data/{collection}` :

| Param    | Format                      | Défaut                                  | Max                         |
| -------- | --------------------------- | --------------------------------------- | --------------------------- |
| `select` | `title,price,cover`         | tous les champs autorisés par la policy |                             |
| `where`  | JSON encodé URL, voir 6.2   | `{}`                                    | profondeur 3, 10 conditions |
| `order`  | `created_at:desc,title:asc` | `created_at:desc`                       | 3 champs                    |
| `limit`  | entier                      | 20                                      | 100                         |
| `cursor` | opaque base64               |                                         |                             |

Pas d'offset. Pagination par curseur uniquement, afin d'éviter les scans profonds à 50 000 sites.

### 6.2 Langage de filtre

JSON, opérateurs en liste fermée. Aucun SQL, aucune expression, aucun opérateur `$where`.

```json
{
  "and": [
    { "field": "published", "op": "eq", "value": true },
    { "field": "price", "op": "lte", "value": 5000 },
    {
      "or": [
        { "field": "tags", "op": "contains", "value": "promo" },
        { "field": "title", "op": "ilike", "value": "%sac%" }
      ]
    }
  ]
}
```

Opérateurs autorisés : `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `contains`, `ilike`, `is_null`, `not_null`.

Tout champ référencé doit exister dans `site_collection.schema.fields`. Sinon `DATA_UNKNOWN_FIELD`. La valeur est castée selon le type déclaré. Le `ilike` est plafonné à 100 caractères et refuse un motif commençant par `%%`.

### 6.3 Auth (end-users)

```
POST /v1/auth/register
POST /v1/auth/login
POST /v1/auth/otp/send
POST /v1/auth/otp/verify
GET  /v1/auth/oauth/{provider}/start
GET  /v1/auth/oauth/{provider}/callback
POST /v1/auth/refresh
POST /v1/auth/logout
GET  /v1/auth/me
PATCH /v1/auth/me
POST /v1/auth/password/reset/request
POST /v1/auth/password/reset/confirm
```

Providers OAuth v1 : `google`, `github`. Les credentials OAuth sont celles de RodiumAi par défaut, avec écran de consentement mentionnant le nom du site. Un owner sur plan Pro peut fournir les siennes via `site_binding.config`.

**Format des tokens.**

- Access token : JWT, HS256, signé par une clé dérivée par site. Durée 15 minutes.
  ```json
  {
    "iss": "https://forgeapi.rodiumai.com" mais en local ca sera du localhost ,
    "sid": "<site_id>",
    "sub": "<end_user_id>",
    "aud": "site",
    "roles": ["user"],
    "exp": 0,
    "iat": 0,
    "jti": "<uuid>"
  }
  ```
  Dérivation de clé : `HKDF-SHA256(master_key, salt=site_id, info="site-jwt-v1")`. La master key vit dans AWS Secrets Manager et tourne tous les 90 jours avec période de recouvrement de 24 heures (deux clés acceptées en vérification, une seule en signature).
- Refresh token : opaque, 48 octets aléatoires, stocké haché en SHA-256, durée 30 jours, rotation à chaque usage, révocation en cascade si réutilisation détectée.

Le refresh token est transmis en cookie `HttpOnly; Secure; SameSite=Lax` scopé sur le domaine du site quand le site est sur son propre domaine, et en payload JSON sinon.

### 6.4 Storage

```
POST   /v1/storage/upload-ticket
POST   /v1/storage/finalize
DELETE /v1/storage/{path}
GET    /v1/storage/url/{path}
```

L'upload direct passe par une URL présignée générée par le gateway, avec `content-length-range` et `content-type` contraints. Le fichier n'entre jamais dans le gateway. Après upload, le client appelle `finalize` qui valide la taille et le type MIME réels et enregistre le fichier.

### 6.5 Email

```
POST /v1/email/send
GET  /v1/email/{message_id}
```

### 6.6 Payment

```
POST /v1/pay/checkout
GET  /v1/pay/intent/{id}
POST /v1/webhooks/{provider}/{site_id}    [public, signé]
```

### 6.7 AI

```
POST /v1/ai/actions/{action_name}
POST /v1/ai/actions/{action_name}/stream    [SSE]
```

### 6.8 Admin de site `[server]`

```
GET    /v1/admin/site
POST   /v1/admin/collections
PATCH  /v1/admin/collections/{name}
DELETE /v1/admin/collections/{name}
POST   /v1/admin/collections/{name}/migrate
GET    /v1/admin/data/{collection}        (bypass policies)
POST   /v1/admin/seed
GET    /v1/admin/usage
POST   /v1/admin/bindings
GET    /v1/admin/policies/simulate
```

`POST /v1/admin/policies/simulate` est utilisé par le builder et par le scan de sécurité pour tester une policy contre un contexte donné sans effet de bord.

### 6.9 En-têtes

**Requête :**

| En-tête            | Obligatoire                     | Contenu                      |
| ------------------ | ------------------------------- | ---------------------------- |
| `Authorization`    | oui                             | `Bearer rds_pub_live_...`    |
| `X-Rodium-Session` | non                             | Access token de l'end-user   |
| `Origin`           | oui pour publishable            | Vérifié contre `site_domain` |
| `Idempotency-Key`  | oui sur `POST /v1/pay/checkout` | UUID fourni par le client    |

**Réponse :**

| En-tête                 | Contenu                                            |
| ----------------------- | -------------------------------------------------- |
| `X-Rodium-Request-Id`   | UUID, à faire remonter dans tout ticket de support |
| `X-Rodium-Cost-Rodi`    | Coût de la requête, 6 décimales                    |
| `X-RateLimit-Remaining` | Quota restant sur la fenêtre courante              |
| `X-RateLimit-Reset`     | Timestamp Unix de reset                            |

---

## 7. Moteur de policies

C'est la partie la plus critique du système. Une erreur ici expose les données de tous les sites.

### 7.1 Format

Chaque collection porte quatre règles. L'absence de règle vaut refus.

```json
{
  "read": { "allow": "public" },
  "list": { "allow": "public", "force": { "published": true } },
  "create": { "allow": "authenticated", "set": { "author_id": "$auth.uid" } },
  "update": {
    "allow": "owner",
    "ownerField": "author_id",
    "immutable": ["author_id", "created_at"]
  },
  "delete": { "allow": "owner", "ownerField": "author_id" }
}
```

### 7.2 Valeurs de `allow`

Liste fermée. Aucune expression arbitraire n'est évaluée. C'est délibéré : un DSL évaluable est une surface d'injection.

| Valeur          | Sémantique                                                   |
| --------------- | ------------------------------------------------------------ |
| `none`          | Refus systématique. C'est le défaut si la règle est absente. |
| `public`        | Autorisé sans authentification.                              |
| `authenticated` | Requiert un `X-Rodium-Session` valide.                       |
| `owner`         | Requiert que `record[ownerField] == auth.uid`.               |
| `role:<name>`   | Requiert que `<name>` figure dans `auth.roles`.              |
| `server`        | Uniquement accessible avec une clé serveur.                  |

### 7.3 Modificateurs

| Clé         | Effet                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `force`     | Conditions ajoutées de force au `where` sur `list` et `read`. Le client ne peut pas les annuler. |
| `set`       | Champs écrasés de force à l'écriture. `$auth.uid`, `$now`, ou une constante.                     |
| `immutable` | Champs qui ne peuvent pas être modifiés après création.                                          |
| `deny`      | Champs jamais renvoyés au client, même s'ils sont demandés dans `select`.                        |
| `maxLimit`  | Plafond de pagination spécifique à la collection.                                                |

### 7.4 Ordre d'évaluation, obligatoire

1. Résolution de la clé de site. Si invalide ou révoquée : `401 AUTH_INVALID_KEY`.
2. Si clé publiable, vérification de l'`Origin` contre `site_domain`. Échec : `403 ORIGIN_NOT_ALLOWED`.
3. Vérification du statut du site. Si `suspended` : `403 SITE_SUSPENDED`.
4. Rate limit L2. Échec : `429`.
5. Résolution du contexte end-user si `X-Rodium-Session` présent. Token invalide : `401 SESSION_INVALID`.
6. Chargement de la collection. Inconnue : `404 DATA_UNKNOWN_COLLECTION`.
7. Sélection de la règle correspondant à l'opération.
8. Évaluation de `allow`. Refus : `403 POLICY_DENIED`.
9. Application de `force` au filtre, avant traduction en requête. **Le filtre forcé est appliqué en dernier dans la clause `AND`, jamais fusionné avec le filtre client.**
10. Validation du payload contre le schéma de la collection. Champs inconnus rejetés, pas ignorés silencieusement.
11. Application de `set` et `immutable`.
12. Exécution via l'adapter.
13. Application de `deny` sur la réponse.
14. Émission de l'usage event.

Pour `update` et `delete` avec `allow: owner`, le gateway effectue une **lecture préalable de l'enregistrement** afin de vérifier la propriété. Ne jamais tenter de fusionner la vérification dans le `WHERE` de l'`UPDATE` : cela masque la distinction entre 404 et 403 et rend le comportement dépendant de l'adapter.

### 7.5 Génération des policies par l'agent

L'agent du builder génère les policies en même temps que le schéma. Trois garde-fous obligatoires :

1. Une collection créée sans policy explicite reçoit `{"read":{"allow":"none"}, ...}`. Elle est inaccessible tant que l'agent n'a pas déclaré son intention.
2. Toute policy contenant `"allow": "public"` sur `create`, `update` ou `delete` déclenche un avertissement bloquant à la publication, que l'owner doit acquitter explicitement.
3. Une collection dont un champ s'appelle `email`, `phone`, `address`, `password`, `token`, `secret`, `iban`, `card` et dont `read.allow` vaut `public` est refusée à la publication. Code `SECURITY_PII_PUBLIC_READ`.

---

## 8. Résolution de la requête et CORS

Le Cloudflare Worker de routage traite tout ce qui arrive sur `*.rodiumsites.io` et sur les domaines custom.

```
1. Extraire Host
2. Lookup Host → { site_id, environment } dans Workers KV (TTL 60s, invalidé au déploiement)
3. Si chemin commence par /_rodium/  → proxy vers forgeapi.rodiumai.com  mais en local ca sera du localhost avec X-Rodium-Site-Id injecté
4. Sinon                             → servir l'asset statique depuis R2
```

Cette indirection donne deux choses : le site généré appelle `/_rodium/v1/data/posts` en **same-origin**, ce qui supprime totalement le préflight CORS et ses 100 à 300 ms de latence supplémentaire sur mobile africain, et le `site_id` est déterminé par le worker et non par le client.

Le gateway continue d'accepter des appels cross-origin directs sur `forgeapi.rodiumai.com` mais en local ca sera du localhost pour le mode preview du builder. Configuration CORS dans ce cas :

```
Access-Control-Allow-Origin: <origine exacte, jamais *>
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: authorization, content-type, x-rodium-session, idempotency-key
Access-Control-Expose-Headers: x-rodium-request-id, x-rodium-cost-rodi, x-ratelimit-remaining
Access-Control-Max-Age: 86400
```

Jamais `Access-Control-Allow-Origin: *` quand `Allow-Credentials` est à `true`.

---

## 9. Rate limiting et quotas

Deux niveaux.

**L1, Cloudflare Worker.** Token bucket par IP et par hostname. 100 requêtes / 10 secondes. Protège le gateway du trafic brut.

**L2, Sites Gateway, Redis.** Algorithme sliding window log en Lua, atomique.

Clés :

```
rl:site:{site_id}:{window}
rl:eu:{site_id}:{end_user_id}:{window}
rl:ip:{site_id}:{ip_hash}:{window}
rl:cap:{site_id}:{capability}:{window}
```

Limites par défaut, par plan :

| Dimension                      | Free | Pro   | Team                             |
| ------------------------------ | ---- | ----- | -------------------------------- |
| Requêtes / minute / site       | 600  | 6 000 | 30 000                           |
| Requêtes / minute / end-user   | 60   | 300   | 600                              |
| Écritures data / minute / site | 60   | 600   | 3 000                            |
| Emails / jour / site           | 20   | 500   | 5 000                            |
| Appels AI / jour / site        | 100  | 5 000 | illimité, plafonné par le wallet |
| Uploads / jour / site          | 50   | 2 000 | 20 000                           |

Le dépassement retourne `429` avec `Retry-After`. Jamais de blocage silencieux.

---

## 10. Facturation en RODI

Chaque requête traitée émet un événement sur le Redis Stream `sites:usage`.

```json
{
  "request_id": "01930f...",
  "site_id": "...",
  "owner_user_id": "...",
  "capability": "data",
  "operation": "list",
  "adapter": "rodium_managed",
  "units": { "requests": 1, "rows_read": 20, "bytes_out": 8421 },
  "rodi_cost": "0.000180",
  "ts": 1756000000
}
```

Le billing worker NestJS consomme le stream, agrège par tranche de 60 secondes et par site, puis débite le wallet en une transaction Prisma unique avec écriture `WalletLedger`, raison `sites_usage`.

### 10.1 Grille tarifaire interne

Elle est configurable en base, table `sites_pricing`, et non codée en dur.

| Opération            | Unité                                             | RODI       |
| -------------------- | ------------------------------------------------- | ---------- |
| Lecture data         | 1 000 lignes lues                                 | 0,009      |
| Écriture data        | 1 000 écritures                                   | 0,090      |
| Stockage data managé | Go / mois                                         | 0,900      |
| Egress               | Go                                                | 0,000 (R2) |
| Upload storage       | Go stocké / mois                                  | 0,450      |
| Email                | 1 000 messages                                    | 4,500      |
| Auth                 | 1 000 sessions créées                             | 0,090      |
| Payment              | par intent créé                                   | 0,900      |
| AI                   | refacturé au coût du gateway IA + marge existante |            |
| Requête gateway      | 1 million de requêtes                             | 0,900      |

Ajuster les valeurs après mesure réelle, mais la structure reste.

### 10.2 Solde insuffisant

Le gateway vérifie le solde du wallet owner en cache Redis, TTL 30 secondes.

- Solde positif : passe.
- Solde à zéro sur un site `free` : les capabilities `email`, `payment`, `ai` retournent `402 INSUFFICIENT_RODI`. Les capabilities `data`, `auth`, `storage` continuent en lecture seule pendant 7 jours, puis le site passe en `suspended`.
- Solde à zéro sur un site `pro` : grâce de 7 jours sur tout, puis lecture seule 7 jours, puis suspension.

Un site suspendu affiche une page servie par le worker, pas une erreur 500. L'owner reçoit un email à J-7, J-3 et J-0.

---

## 11. Runtime figé et manifeste de paquets

### 11.1 Manifeste

Le runtime est versionné en semver. `site.runtime_version` référence une entrée de la table `runtime_manifest`. Un site est verrouillé sur sa version jusqu'à migration explicite.

Manifeste `1.0.0`, liste fermée :

```json
{
  "version": "1.0.0",
  "engine": { "node": "22.x", "vite": "6.x" },
  "dependencies": {
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "react-router-dom": "7.1.1",
    "@rodiumai/site-sdk": "1.0.0",
    "tailwindcss": "4.0.0",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "tailwind-merge": "2.6.0",
    "lucide-react": "0.469.0",
    "@radix-ui/react-dialog": "1.1.4",
    "@radix-ui/react-dropdown-menu": "2.1.4",
    "@radix-ui/react-select": "2.1.4",
    "@radix-ui/react-tabs": "1.1.2",
    "@radix-ui/react-toast": "1.2.4",
    "@radix-ui/react-accordion": "1.2.2",
    "@radix-ui/react-popover": "1.1.4",
    "@radix-ui/react-slot": "1.1.1",
    "@tanstack/react-query": "5.62.0",
    "react-hook-form": "7.54.2",
    "@hookform/resolvers": "3.10.0",
    "zod": "3.24.1",
    "date-fns": "4.1.0",
    "recharts": "2.15.0",
    "framer-motion": "11.15.0",
    "embla-carousel-react": "8.5.1",
    "sonner": "1.7.1",
    "cmdk": "1.0.4"
  }
}
```

Règles :

- L'agent ne peut importer que ces paquets. Toute autre importation est rejetée par le validateur avant compilation, avec le code `BUILD_FORBIDDEN_IMPORT`.
- Le validateur est un pass AST sur les `ImportDeclaration` et les `import()` dynamiques, exécuté avant le build. Ne pas se reposer sur l'échec du bundler : le message d'erreur serait inexploitable pour l'agent.
- Les imports relatifs (`./`, `../`) et les alias `@/` sont autorisés sans restriction dans le périmètre du projet.
- Aucun accès à `node:*`, `fs`, `process`, `eval`, `new Function`, `document.write`. Rejet AST.

### 11.2 Bundle runtime préconstruit

Pour chaque version du manifeste, un job CI produit :

```
https://runtime.rodiumai.io/1.0.0/vendor.js       ESM, toutes les deps, Cache-Control: immutable, 1 an
https://runtime.rodiumai.io/1.0.0/vendor.css      Tailwind base + tokens
https://runtime.rodiumai.io/1.0.0/importmap.json
```

Le preview navigateur compile uniquement les fichiers utilisateur via `esbuild-wasm`, avec `external` sur toutes les entrées du manifeste, et résout via l'import map. Aucun `node_modules` côté client. Aucun sandbox serveur.

Le build de publication, lui, produit un bundle complet et autonome dans le build worker.

---

## 12. Quotas de site

| Ressource                                   | Free   | Pro     | Team      |
| ------------------------------------------- | ------ | ------- | --------- |
| Fichiers source par projet                  | 60     | 300     | 800       |
| Taille d'un fichier source                  | 100 Ko | 200 Ko  | 200 Ko    |
| Collections par site                        | 8      | 40      | 100       |
| Champs par collection                       | 25     | 60      | 60        |
| Enregistrements par site (`rodium_managed`) | 5 000  | 250 000 | 2 000 000 |
| Taille d'un enregistrement                  | 64 Ko  | 256 Ko  | 256 Ko    |
| Stockage fichiers                           | 200 Mo | 20 Go   | 200 Go    |
| Domaines custom                             | 0      | 1       | 10        |
| Index custom par collection                 | 2      | 5       | 5         |
| End-users par site                          | 500    | 50 000  | illimité  |

---

## 13. Codes d'erreur

Format uniforme, jamais de stack trace, jamais de détail interne.

```json
{
  "error": {
    "code": "POLICY_DENIED",
    "message": "Cette opération n'est pas autorisée sur la collection 'orders'.",
    "type": "authorization",
    "request_id": "01930f7c-...",
    "details": { "collection": "orders", "operation": "list" }
  }
}
```

| Code                            | HTTP | Type            |
| ------------------------------- | ---- | --------------- |
| `AUTH_INVALID_KEY`              | 401  | authentication  |
| `AUTH_KEY_REVOKED`              | 401  | authentication  |
| `SESSION_INVALID`               | 401  | authentication  |
| `SESSION_EXPIRED`               | 401  | authentication  |
| `ORIGIN_NOT_ALLOWED`            | 403  | authorization   |
| `POLICY_DENIED`                 | 403  | authorization   |
| `SITE_SUSPENDED`                | 403  | authorization   |
| `SERVER_KEY_REQUIRED`           | 403  | authorization   |
| `DATA_UNKNOWN_COLLECTION`       | 404  | invalid_request |
| `DATA_UNKNOWN_FIELD`            | 400  | invalid_request |
| `DATA_VALIDATION_FAILED`        | 400  | invalid_request |
| `DATA_IMMUTABLE_FIELD`          | 400  | invalid_request |
| `RECORD_NOT_FOUND`              | 404  | invalid_request |
| `EMAIL_RECIPIENT_NOT_ALLOWED`   | 403  | authorization   |
| `PAYMENT_AMOUNT_NOT_ACCEPTED`   | 400  | invalid_request |
| `AI_ACTION_UNKNOWN`             | 404  | invalid_request |
| `AI_MODEL_NOT_ALLOWED`          | 403  | authorization   |
| `RATE_LIMIT_EXCEEDED`           | 429  | rate_limit      |
| `SITE_DATA_QUOTA_EXCEEDED`      | 429  | quota           |
| `INSUFFICIENT_RODI`             | 402  | billing         |
| `CONNECTOR_UNAVAILABLE`         | 502  | upstream        |
| `CONNECTOR_INVALID_CREDENTIALS` | 502  | upstream        |
| `INTERNAL_ERROR`                | 500  | internal        |

Un échec de connector tiers ne doit jamais retourner 500. Il retourne 502 avec le nom du provider, sans le détail de l'erreur upstream.

---

## 14. Export

Trois modes, choisis par l'owner.

**A. Statique pur.** Le validateur vérifie qu'aucun appel SDK n'est présent. Le ZIP contient le projet Vite complet. Le site fonctionne partout, sans backend.

**B. Connecté (défaut sur plan Pro).** Le ZIP contient le projet plus un `.env.example` :

````
VITE_RODIUM_SITE_KEY=rds_pub_live_xxxxxxxxxxxx
VITE_RODIUM_API_URL=https://forgeapi.rodiumai.com
 mais en local ca sera du localhost ```

Le site exporté continue de consommer le Sites Gateway et le wallet RODI de l'owner. La clé publiable exportée est liée aux origines déclarées dans `site_domain`, auxquelles l'owner peut ajouter son propre domaine d'hébergement depuis le dashboard.

**C. Détachement (v2, pas en v1).** Génération d'un projet autonome avec un backend réel. Documenté en section 16.

Le ZIP contient dans tous les cas :

````

/src, /public, package.json, vite.config.ts, tsconfig.json,
tailwind.config.ts, .env.example, README.md, LICENSE

````

Le `README.md` est généré et documente la structure, les collections déclarées, les policies actives et la procédure de déploiement.

---

## 15. Observabilité

**Logs structurés (Pino côté Node, structlog côté FastAPI).** Un log par requête, champs obligatoires : `request_id`, `site_id`, `owner_user_id`, `capability`, `operation`, `adapter`, `status`, `duration_ms`, `rodi_cost`, `end_user_id` si présent. Jamais le payload, jamais les credentials, jamais le contenu des enregistrements.

**Table de journalisation, partitionnée par jour, rétention 30 jours :**

```sql
CREATE TABLE site_request_log (
  ts          TIMESTAMPTZ NOT NULL,
  request_id  UUID NOT NULL,
  site_id     UUID NOT NULL,
  capability  TEXT NOT NULL,
  operation   TEXT NOT NULL,
  adapter     TEXT NOT NULL,
  status      INT NOT NULL,
  duration_ms INT NOT NULL,
  error_code  TEXT,
  rodi_cost   NUMERIC(18,6) NOT NULL DEFAULT 0
) PARTITION BY RANGE (ts);
````

Cron de création des partitions à 02:00 UTC, aligné sur ce qui existe déjà pour `request_log` du gateway IA.

**Métriques Prometheus obligatoires :**

- `sites_request_duration_seconds` (histogram, labels: capability, operation, adapter)
- `sites_request_total` (counter, labels: capability, status, error_code)
- `sites_policy_denied_total` (counter, label: site_id échantillonné)
- `sites_adapter_upstream_duration_seconds` (histogram, label: provider)
- `sites_kms_decrypt_total` (counter) — un pic signale un problème de cache DEK
- `sites_rodi_debited_total` (counter)

**Alertes :**

| Condition                                           | Sévérité                       |
| --------------------------------------------------- | ------------------------------ |
| Taux de 5xx > 1 % sur 5 min                         | critique                       |
| `sites_kms_decrypt_total` > 50/s                    | avertissement                  |
| p99 duration > 2 s sur `data`                       | avertissement                  |
| `sites_policy_denied_total` > 1000/min pour un site | avertissement, possible scan   |
| Lag du Redis Stream `sites:usage` > 60 s            | critique, perte de facturation |

---

## 16. Structure du service

```
rodium_sites_gateway/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── deps.py
│   ├── middleware/
│   │   ├── request_id.py
│   │   ├── site_auth.py           # résolution clé + origine
│   │   ├── session_auth.py        # résolution end-user JWT
│   │   ├── rate_limit.py
│   │   └── error_handler.py
│   ├── routers/
│   │   ├── data.py
│   │   ├── auth.py
│   │   ├── storage.py
│   │   ├── email.py
│   │   ├── payment.py
│   │   ├── ai.py
│   │   ├── webhooks.py
│   │   └── admin.py
│   ├── core/
│   │   ├── context.py             # SiteContext
│   │   ├── policy.py              # moteur de policies
│   │   ├── filter.py              # parseur du langage de filtre
│   │   ├── schema.py              # validation de payload
│   │   ├── crypto.py              # enveloppe KMS
│   │   ├── metering.py            # émission usage events
│   │   └── errors.py
│   ├── adapters/
│   │   ├── base.py                # Protocols
│   │   ├── registry.py            # capability + provider → adapter
│   │   ├── data/{managed,supabase,firestore}.py
│   │   ├── auth/{managed,supabase,firebase}.py
│   │   ├── storage/{r2,cloudinary,s3,supabase}.py
│   │   ├── email/{ses,resend}.py
│   │   ├── payment/fedapay.py
│   │   └── ai/rodiumai.py
│   └── db/
│       ├── session.py
│       ├── models.py
│       └── migrations/
├── tests/
│   ├── test_policy_matrix.py      # obligatoire, voir 17
│   ├── test_filter_injection.py
│   └── test_tenant_isolation.py
├── Dockerfile
└── pyproject.toml
```

### Variables d'environnement

```
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=rediss://...
KMS_KEY_ID=arn:aws:kms:eu-west-1:...:key/...
SITE_JWT_MASTER_SECRET_ARN=arn:aws:secretsmanager:...
RODIUM_AI_INTERNAL_KEY=...
RODIUM_AI_BASE_URL=https://api.rodiumai.io/v1
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_SITES=rodium-sites
SES_REGION=eu-west-1
USAGE_STREAM=sites:usage
ENVIRONMENT=production
LOG_LEVEL=info
```

---

## 17. Tests obligatoires avant mise en production

Ces tests sont bloquants en CI. Aucun déploiement sans eux.

1. **Matrice de policies.** Pour chaque combinaison (`allow` × opération × présence de session × rôle), vérifier autorisation ou refus. 6 valeurs de `allow` × 5 opérations × 3 contextes = 90 cas minimum.
2. **Isolation multi-tenant.** Créer deux sites, insérer des données dans chacun, et vérifier que la clé du site A ne peut jamais lire, lister, compter, modifier ou supprimer une donnée du site B. Inclure les tentatives via `where` sur `site_id` et via un `id` connu.
3. **Injection dans le filtre.** Fuzzing du langage de filtre avec des chaînes SQL, des noms de champs inexistants, des profondeurs de nesting excessives, des opérateurs inconnus, des `ilike` pathologiques.
4. **Non-annulation de `force`.** Vérifier qu'un client ne peut pas contourner `force: {published: true}` via un `or`, un `not`, ou un champ homonyme.
5. **Fuite de champ `deny`.** Vérifier que le champ n'apparaît ni dans la réponse, ni dans un message d'erreur de validation, ni dans un tri.
6. **Redaction des logs.** Assertion qu'aucune credential ne figure dans la sortie du logger pour chaque adapter.
7. **Idempotence des paiements.** Deux `POST /v1/pay/checkout` avec la même `Idempotency-Key` produisent un seul intent.
8. **Rotation du refresh token.** Réutilisation d'un refresh token consommé révoque toute la famille de sessions.
9. **Validateur d'imports.** Un fichier généré important `axios` échoue avec `BUILD_FORBIDDEN_IMPORT`, pas avec une erreur de bundler.

---

## 18. Phasage d'implémentation

**Phase A, socle (semaines 1 à 3)**
Modèle de données du control plane. Chiffrement KMS. Middleware `site_auth` + `session_auth`. Rate limit. Codes d'erreur. Metering et Redis Stream. Capability `data` avec l'adapter `rodium_managed` uniquement. Moteur de policies complet avec sa matrice de tests. Le worker de routage Cloudflare.

**Phase B, auth et storage (semaines 4 à 5)**
`RodiumManagedAuth` (email + mot de passe, OTP, Google OAuth). `RodiumManagedStorage` sur R2 avec URL présignées. SDK client `@rodiumai/site-sdk` v0.1.

**Phase C, connectors externes (semaines 6 à 8)**
`SupabaseData`, `SupabaseAuth`, `SupabaseStorage`. `CloudinaryStorage`. `ResendEmail`. `FirestoreData` et `FirebaseAuth`.

**Phase D, monétisation (semaines 9 à 10)**
`FedaPayPayment` avec webhooks et idempotence. `RodiumAiGateway` avec AI actions déclaratives. Grille tarifaire et intégration au billing worker.

**Phase E, durcissement (semaines 11 à 12)**
Scan de sécurité au publish. Simulateur de policies. Quotas et suspension. Observabilité complète et alerting. Tests de charge à 5 000 requêtes par seconde.

---

## 19. Décisions reportées en v2, à ne pas anticiper

Ces points sont hors périmètre. Ne pas les préparer, ne pas laisser de crochets spéculatifs dans le code.

- **Actions serveur custom.** Exécution de JS utilisateur dans un isolate V8 avec un budget CPU. Nécessaire dès que les sites feront de la logique métier réelle.
- **Realtime.** WebSocket ou SSE sur les changements de collection. Coûteux, à ne faire qu'à la demande.
- **Détachement complet.** Génération d'un backend autonome (Fastify + Prisma + Postgres) à partir des collections et policies déclarées. C'est la promesse "pas de vendor lock-in" à long terme.
- **Cron et jobs planifiés** par site.
- **Recherche plein texte** au-delà du `ilike`.
- **Migration `rodium_managed` vers Supabase** avec transfert de données et réécriture des policies en RLS.

---

## 20. Points d'attention réglementaires

- **RODI reste des crédits d'infrastructure prépayés.** Toute la documentation de ce backend, y compris les messages d'erreur destinés aux utilisateurs, doit employer cette formulation. Jamais « monnaie », jamais « e-money », jamais « token ».
- **FedaPay est le processeur de paiement licencié.** Le Sites Gateway ne détient jamais de fonds pour le compte d'un end-user. Les flux de paiement d'un site généré vont directement au compte FedaPay de l'owner, RodiumAi ne prélève qu'un frais de service en RODI sur le wallet de l'owner.
- **Données personnelles des end-users.** Les sites générés collectent des données pour le compte de leurs owners. Le rôle de RodiumAi est celui de sous-traitant. La politique de confidentialité publiée sur `rodiumai.io/privacy` et les conditions d'utilisation sur `rodiumai.io/terms` doivent être mises à jour pour couvrir explicitement l'hébergement de contenu généré par les utilisateurs, la responsabilité de l'owner sur les données de ses visiteurs, et la procédure de retrait de contenu illicite.
- **Rétention.** Les données d'un site supprimé sont purgées sous 30 jours. Les logs sous 30 jours. Les enregistrements financiers sont conservés selon les obligations comptables applicables.
