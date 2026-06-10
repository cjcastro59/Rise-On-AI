import { NextResponse, NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
