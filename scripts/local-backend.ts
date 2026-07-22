import { serve } from 'bun'

const PORT = 3000

const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const pathname = url.pathname

    console.log(`[Request] ${req.method} ${pathname}`)

    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // 1. Healthz
    if (pathname === '/api/healthz') {
      return Response.json({ status: 'ok' }, { headers: corsHeaders })
    }

    // 2. Auth CLI Code (Start Login Flow)
    if (pathname === '/api/auth/cli/code') {
      return Response.json({
        loginUrl: `http://localhost:${PORT}/login-success`,
        fingerprintHash: 'local-fingerprint-hash',
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      }, { headers: corsHeaders })
    }

    // 3. Auth CLI Status (Check Login Flow Status)
    if (pathname === '/api/auth/cli/status') {
      // Auto-approve login instantly for local developer convenience
      return Response.json({
        user: {
          id: 'local-user-id',
          email: 'local@codebuff.dev',
          name: 'Local Developer',
          authToken: 'local-auth-token-12345',
        }
      }, { headers: corsHeaders })
    }

    // 4. Me Endpoint
    if (pathname === '/api/v1/me') {
      return Response.json({
        id: 'local-user-id',
        email: 'local@codebuff.dev',
        discord_id: null,
      }, { headers: corsHeaders })
    }

    // 5. Usage
    if (pathname === '/api/v1/usage') {
      return Response.json({
        type: 'usage-response',
        usage: 0,
        remainingBalance: 999999,
        balanceBreakdown: {},
        next_quota_reset: null,
      }, { headers: corsHeaders })
    }

    // 6. Agent Runs
    if (pathname === '/api/v1/agent-runs') {
      return Response.json({
        runId: `local-run-${Math.random().toString(36).substring(2, 9)}`
      }, { headers: corsHeaders })
    }

    if (pathname.startsWith('/api/v1/agent-runs/') && pathname.endsWith('/steps')) {
      return Response.json({
        stepId: `local-step-${Math.random().toString(36).substring(2, 9)}`
      }, { headers: corsHeaders })
    }

    // 7. Publish
    if (pathname === '/api/agents/publish') {
      return Response.json({
        success: true,
        version: '0.0.0-local'
      }, { headers: corsHeaders })
    }

    // 8. Logout
    if (pathname === '/api/auth/cli/logout') {
      return Response.json({ success: true }, { headers: corsHeaders })
    }

    // 9. Feedback
    if (pathname === '/api/v1/feedback') {
      return Response.json({ success: true }, { headers: corsHeaders })
    }

    // 10. Agent Database Endpoint (return 404, fall back to local templates)
    if (pathname.startsWith('/api/v1/agents/')) {
      return new Response(JSON.stringify({ error: 'Agent not found in local database' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 11. Chat Completions - Proxy to live LLM provider
    if (pathname === '/api/v1/chat/completions') {
      let body: any
      try {
        body = await req.json()
      } catch (err) {
        return new Response(JSON.stringify({ error: { message: 'Invalid JSON body' } }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Determine downstream LLM provider and headers
      let targetUrl = 'https://api.openai.com/v1/chat/completions'
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      const openRouterKey = process.env.OPENROUTER_API_KEY
      const openAiKey = process.env.OPENAI_API_KEY
      const deepseekKey = process.env.DEEPSEEK_API_KEY
      const localLlmUrl = process.env.LOCAL_LLM_URL // e.g. http://localhost:11434/v1/chat/completions

      if (localLlmUrl) {
        targetUrl = localLlmUrl
      } else if (openRouterKey) {
        targetUrl = 'https://openrouter.ai/api/v1/chat/completions'
        headers['Authorization'] = `Bearer ${openRouterKey}`
      } else if (deepseekKey) {
        targetUrl = 'https://api.deepseek.com/v1/chat/completions'
        headers['Authorization'] = `Bearer ${deepseekKey}`
      } else if (openAiKey) {
        targetUrl = 'https://api.openai.com/v1/chat/completions'
        headers['Authorization'] = `Bearer ${openAiKey}`
      } else {
        console.warn('[Proxy Warning] No LLM API key configured in backend environment variables.')
        return new Response(
          JSON.stringify({
            error: {
              message: 'No LLM API key configured in backend environment variables. Please set OPENAI_API_KEY, OPENROUTER_API_KEY, DEEPSEEK_API_KEY, or LOCAL_LLM_URL.',
            }
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // If client passed a custom key in BYOK_OPENROUTER_HEADER, check that
      const byokHeader = req.headers.get('x-byok-openrouter-key')
      if (byokHeader) {
        targetUrl = 'https://openrouter.ai/api/v1/chat/completions'
        headers['Authorization'] = `Bearer ${byokHeader}`
      }

      console.log(`[Proxy] Routing request to ${targetUrl} for model ${body.model}`)

      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })

        // Copy response headers (like content-type)
        const responseHeaders = new Headers(corsHeaders)
        for (const [key, value] of response.headers.entries()) {
          if (key.toLowerCase() !== 'content-encoding') {
            responseHeaders.set(key, value)
          }
        }

        return new Response(response.body, {
          status: response.status,
          headers: responseHeaders,
        })
      } catch (err) {
        console.error('[Proxy Error]', err)
        return new Response(
          JSON.stringify({ error: { message: `Backend proxy error: ${err}` } }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response('Not Found', { status: 404 })
  }
})

console.log(`🚀 Codebuff local backend running at http://localhost:${server.port}`)
