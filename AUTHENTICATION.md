# Autenticação com NextAuth

Este projeto utiliza NextAuth.js para autenticação, protegendo o acesso ao dashboard e às rotas de gerenciamento de fontes.

## Configuração

### 1. Criar Credenciais do Google OAuth

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Vá para **APIs & Services > Credentials**
4. Clique em **Create Credentials > OAuth 2.0 Client ID**
5. Configure a tela de consentimento OAuth se solicitado
6. Selecione **Web application** como tipo
7. Configure as URLs autorizadas:
   - **Authorized JavaScript origins**: `http://localhost:3000` (desenvolvimento)
   - **Authorized redirect URIs**: 
     - `http://localhost:3000/api/auth/callback/google` (desenvolvimento)
     - `https://seu-dominio.com/api/auth/callback/google` (produção)
8. Copie o **Client ID** e **Client Secret**

### 2. Configurar Variáveis de Ambiente

Adicione as seguintes variáveis ao arquivo `.env.local`:

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret

# NextAuth Secret (gere com: openssl rand -base64 32)
NEXTAUTH_SECRET=seu-nextauth-secret-aqui

# NextAuth URL
NEXTAUTH_URL=http://localhost:3000

# Emails Autorizados (separados por vírgula)
ALLOWED_EMAILS=email1@example.com,email2@example.com,email3@example.com
```

### 3. Gerar NextAuth Secret

Execute o seguinte comando para gerar um secret seguro:

```bash
openssl rand -base64 32
```

## Rotas Protegidas

As seguintes rotas requerem autenticação:

- `/dashboard` - Dashboard principal
- `/sources/*` - Gerenciamento de fontes
- `/api/sources/*` - API de gerenciamento de fontes

## Fluxo de Autenticação

1. Usuário acessa uma rota protegida (ex: `/dashboard`)
2. Se não autenticado, é redirecionado para `/auth/signin`
3. Usuário clica em "Entrar com Google"
4. Após autenticação, o email é validado contra `ALLOWED_EMAILS`
5. Se autorizado, redireciona para `/dashboard`
6. Se não autorizado, redireciona para `/auth/error`

## Controle de Acesso

O controle de acesso é feito através da variável de ambiente `ALLOWED_EMAILS`, que contém uma lista de emails separados por vírgula.

### Adicionar/Remover Usuários

Edite a variável `ALLOWED_EMAILS` no arquivo `.env.local`:

```env
ALLOWED_EMAILS=user1@gmail.com,user2@company.com,user3@organization.org
```

**Importante:** Após alterar a lista de emails autorizados, reinicie o servidor.

## Segurança

- O middleware valida a sessão automaticamente em todas as rotas protegidas
- Apenas emails listados em `ALLOWED_EMAILS` podem acessar o dashboard
- A validação ocorre no callback `signIn` do NextAuth
- As sessões são gerenciadas de forma segura pelo NextAuth

## Páginas de Autenticação

- `/auth/signin` - Página de login com Google
- `/auth/error` - Página de erro de autenticação (acesso negado)

## Componentes

### AuthProvider

Envolve a aplicação com `SessionProvider` do NextAuth, disponibilizando o estado da sessão para todos os componentes.

### Navbar

Exibe informações do usuário logado e botões de login/logout:
- Se não autenticado: botão "Entrar"
- Se autenticado: email do usuário + botão "Sair"

## Produção

Para produção no Vercel:

1. Configure as variáveis de ambiente no painel do Vercel:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (URL do seu domínio)
   - `ALLOWED_EMAILS`

2. Adicione a URL de produção nas configurações do Google OAuth:
   - `https://seu-dominio.com/api/auth/callback/google`

## Troubleshooting

### Erro: "ALLOWED_EMAILS not configured"

Verifique se a variável `ALLOWED_EMAILS` está definida no `.env.local`.

### Erro: "Access denied"

Seu email não está na lista de emails autorizados. Adicione-o em `ALLOWED_EMAILS`.

### Erro de redirect_uri_mismatch

Verifique se a URL de callback está configurada corretamente no Google Cloud Console.

## Referências

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth Setup](https://next-auth.js.org/providers/google)
