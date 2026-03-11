import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
var supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export var supabase = createClient(supabaseUrl, supabaseKey);
