// supabase/functions/payment-reminders/index.ts
// Cron job to send payment reminders for dues due in 7 days

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  console.log('Payment reminders cron job started')
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  // Calculate date 7 days from now
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  const targetDate = sevenDaysFromNow.toISOString().split('T')[0]
  
  console.log('Looking for dues due on:', targetDate)
  
  // Find unpaid dues due in 7 days
  const { data: dues, error: duesError } = await supabase
    .from('dues')
    .select(`
      expense_id,
      id_2,
      amount,
      expense_info!inner(title, due_date)
    `)
    .eq('paid', false)
    .eq('expense_info.due_date', targetDate)
  
  if (duesError) {
    console.error('Error fetching dues:', duesError)
    return new Response(JSON.stringify({ error: duesError.message }), { status: 500 })
  }
  
  console.log(`Found ${dues?.length ?? 0} dues due in 7 days`)
  
  let notificationsSent = 0
  
  // Create activity for each user with upcoming payment
  for (const due of dues ?? []) {
    const expenseTitle = due.expense_info?.title || 'an expense'
    
    const { error: activityError } = await supabase
      .from('activities')
      .insert({
        user_id: due.id_2,
        type: 'payment_due_7_days',
        title: 'Payment Due Soon',
        message: `You have a payment due in 7 days for "${expenseTitle}"`,
        related_id: due.expense_id,
        is_read: false
      })
    
    if (activityError) {
      console.error('Error creating activity for user:', due.id_2, activityError)
    } else {
      notificationsSent++
      console.log('Created reminder activity for user:', due.id_2)
    }
  }
  
  console.log(`Payment reminders completed. Sent ${notificationsSent} notifications.`)
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      duesFound: dues?.length ?? 0,
      notificationsSent 
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
