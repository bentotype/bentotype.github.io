// supabase/functions/send-push/index.ts
// Sends push notifications via Apple Push Notification Service (APNs)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = await req.json()
    
    console.log('Received activity record:', JSON.stringify(record))
    
    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Get user's device token
    const { data: user, error: userError } = await supabase
      .from('user_info')
      .select('device_token')
      .eq('id', record.user_id)
      .single()
    
    if (userError || !user?.device_token) {
      console.log('No device token found for user:', record.user_id)
      return new Response(
        JSON.stringify({ success: false, error: 'No device token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }
    
    console.log('Sending push to device:', user.device_token.substring(0, 10) + '...')
    
    // Build APNs payload
    const payload = {
      aps: {
        alert: {
          title: record.title || 'Split',
          body: record.message || 'You have a new notification'
        },
        sound: 'default',
        badge: 1
      },
      // Custom data that can be accessed by your app
      activityId: record.id,
      activityType: record.type,
      relatedId: record.related_id
    }
    
    // Create APNs JWT token
    const jwt = await createAPNsJWT()
    
    // Determine APNs environment (sandbox for development, production for App Store)
    const apnsHost = Deno.env.get('APNS_ENVIRONMENT') === 'production' 
      ? 'api.push.apple.com' 
      : 'api.sandbox.push.apple.com'
    
    // Send to APNs
    const response = await fetch(
      `https://${apnsHost}/3/device/${user.device_token}`,
      {
        method: 'POST',
        headers: {
          'authorization': `bearer ${jwt}`,
          'apns-topic': Deno.env.get('APP_BUNDLE_ID') ?? '',
          'apns-push-type': 'alert',
          'apns-priority': '10',
        },
        body: JSON.stringify(payload)
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('APNs error:', response.status, errorText)
      return new Response(
        JSON.stringify({ success: false, error: errorText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }
    
    console.log('Push notification sent successfully')
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
    
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// Create JWT token for APNs authentication
async function createAPNsJWT(): Promise<string> {
  const keyId = Deno.env.get('APNS_KEY_ID') ?? ''
  const teamId = Deno.env.get('APNS_TEAM_ID') ?? ''
  const privateKeyPem = Deno.env.get('APNS_KEY_P8') ?? ''
  
  // JWT Header
  const header = { alg: 'ES256', kid: keyId }
  
  // JWT Payload
  const now = Math.floor(Date.now() / 1000)
  const payload = { iss: teamId, iat: now }
  
  // Encode header and payload
  const encoder = new TextEncoder()
  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  
  // Import the private key
  const privateKey = await importPrivateKey(privateKeyPem)
  
  // Sign the token
  const data = encoder.encode(`${headerB64}.${payloadB64}`)
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data
  )
  
  const signatureB64 = arrayBufferToBase64Url(signature)
  return `${headerB64}.${payloadB64}.${signatureB64}`
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and whitespace
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  
  // Decode base64
  const binary = atob(b64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
  
  // Import as ECDSA P-256 key
  return await crypto.subtle.importKey(
    'pkcs8',
    buffer.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
