'use client';

import { useState, useEffect, useCallback } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { KanbanBusiness, KanbanColumnId, KanbanResponse } from '@/app/api/kanban/route';
import KanbanColumn from './KanbanColumn';

const COLUMN_ORDER: KanbanColumnId[] = [
  'sin_contactar',
  'contactados',
  'interesados',
  'follow_up',
  'descartados',
];

// Mapeo de columna destino a lead_status
const COLUMN_TO_STATUS: Record<KanbanColumnId, string | null> = {
  sin_contactar: 'no_contact',
  contactados: 'no_contact',
  interesados: 'prospect',
  follow_up: 'no_contact',
  descartados: 'discarded',
};

export default function KanbanBoard() {
  const [columns, setColumns] = useState<Record<KanbanColumnId, KanbanBusiness[]>>({
    sin_contactar: [],
    contactados: [],
    interesados: [],
    follow_up: [],
    descartados: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchKanbanData = useCallback(async () => {
    try {
      const response = await fetch('/api/kanban');
      if (!response.ok) throw new Error('Error al cargar datos');
      const data: KanbanResponse = await response.json();
      setColumns(data.columns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKanbanData();
  }, [fetchKanbanData]);

  const updateBusinessStatus = async (businessId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_status: newStatus }),
      });
      if (!response.ok) {
        throw new Error('Error al actualizar estado');
      }
    } catch (err) {
      console.error('Error updating business status:', err);
      // Revertir cambios recargando datos
      fetchKanbanData();
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Si no hay destino o es el mismo lugar, no hacer nada
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceColumn = source.droppableId as KanbanColumnId;
    const destColumn = destination.droppableId as KanbanColumnId;

    // Encontrar el negocio que se movió
    const business = columns[sourceColumn].find((b) => b.id === draggableId);
    if (!business) return;

    // Actualizar estado optimistamente
    setColumns((prev) => {
      const newColumns = { ...prev };

      // Remover de la columna origen
      newColumns[sourceColumn] = prev[sourceColumn].filter((b) => b.id !== draggableId);

      // Agregar a la columna destino en la posición correcta
      const destItems = [...prev[destColumn].filter((b) => b.id !== draggableId)];
      destItems.splice(destination.index, 0, {
        ...business,
        lead_status: COLUMN_TO_STATUS[destColumn],
      });
      newColumns[destColumn] = destItems;

      return newColumns;
    });

    // Actualizar en la base de datos si cambió la columna
    if (sourceColumn !== destColumn) {
      const newStatus = COLUMN_TO_STATUS[destColumn];
      if (newStatus) {
        updateBusinessStatus(draggableId, newStatus);
      }
    }
  };

  const handleAction = async (businessId: string, action: 'whatsapp' | 'email' | 'call') => {
    // Encontrar el negocio
    let business: KanbanBusiness | undefined;
    let sourceColumn: KanbanColumnId | undefined;

    for (const col of COLUMN_ORDER) {
      const found = columns[col].find((b) => b.id === businessId);
      if (found) {
        business = found;
        sourceColumn = col;
        break;
      }
    }

    if (!business || !sourceColumn) return;

    // Actualizar contact_actions optimistamente
    const currentActions = business.contact_actions || [];
    if (!currentActions.includes(action)) {
      setColumns((prev) => {
        const newColumns = { ...prev };
        newColumns[sourceColumn!] = prev[sourceColumn!].map((b) => {
          if (b.id === businessId) {
            return {
              ...b,
              contact_actions: [...currentActions, action],
              daysSinceContact: 0,
            };
          }
          return b;
        });
        return newColumns;
      });

      // Registrar acción en la API
      try {
        await fetch('/api/contact-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId,
            actionType: action,
            isFollowUp: currentActions.length > 0,
          }),
        });

        // Actualizar contact_actions en el negocio
        await fetch(`/api/businesses/${businessId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_actions: [...currentActions, action],
          }),
        });

        // Recargar para reclasificar si es necesario
        setTimeout(() => fetchKanbanData(), 500);
      } catch (err) {
        console.error('Error registering action:', err);
        fetchKanbanData();
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500">Cargando pipeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <p>{error}</p>
          <button
            onClick={fetchKanbanData}
            className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const totalLeads = COLUMN_ORDER.reduce((sum, col) => sum + columns[col].length, 0);

  return (
    <div className="h-full">
      {/* Stats rápidos */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
        <span><strong>{totalLeads}</strong> leads en total</span>
        <span className="text-green-600"><strong>{columns.interesados.length}</strong> interesados</span>
        <span className="text-amber-600"><strong>{columns.follow_up.length}</strong> necesitan follow-up</span>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMN_ORDER.map((columnId) => (
            <KanbanColumn
              key={columnId}
              columnId={columnId}
              businesses={columns[columnId]}
              onAction={handleAction}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
