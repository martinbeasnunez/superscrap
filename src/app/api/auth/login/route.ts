import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Nombre y email son requeridos' },
        { status: 400 }
      );
    }

    // Buscar usuario existente
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      // Actualizar nombre si cambió
      if (existingUser.name !== name) {
        await supabase
          .from('users')
          .update({ name })
          .eq('id', existingUser.id);
        existingUser.name = name;
      }
      return NextResponse.json({ user: existingUser });
    }

    // Crear nuevo usuario
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        name,
        email: email.toLowerCase(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return NextResponse.json(
        { error: 'Error al crear usuario' },
        { status: 500 }
      );
    }

    return NextResponse.json({ user: newUser });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
