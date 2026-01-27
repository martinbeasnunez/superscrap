'use client';

import { useState, useEffect, useCallback } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { KanbanBusiness, KanbanColumnId, KanbanResponse } from '@/app/api/kanban/route';
import KanbanColumn from './KanbanColumn';
import LeadDetailModal from './LeadDetailModal';

const COLUMN_ORDER: KanbanColumnId[] = [
  'nuevo',
  'contactado',
  'interesado',
  'cotizado',
  'cliente',
  'perdido',
];

export default function KanbanBoard() {
  const [columns, setColumns] = useState<Record<KanbanColumnId, KanbanBusiness[]>>({
    nuevo: [],
    contactado: [],
    interesado: [],
    cotizado: [],
    cliente: [],
    perdido: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<KanbanBusiness | null>(null);

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

  const updateBusinessStage = async (businessId: string, newStage: KanbanColumnId) => {
    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales_stage: newStage }),
      });
      if (!response.ok) {
        throw new Error('Error al actualizar etapa');
      }
    } catch (err) {
      console.error('Error updating business stage:', err);
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
        sales_stage: destColumn,
      });
      newColumns[destColumn] = destItems;

      return newColumns;
    });

    // Actualizar en la base de datos si cambió la columna
    if (sourceColumn !== destColumn) {
      updateBusinessStage(draggableId, destColumn);
    }
  };

  const handleCardClick = (business: KanbanBusiness) => {
    setSelectedBusiness(business);
  };

  const handleStageChange = (businessId: string, newStage: KanbanColumnId) => {
    // Encontrar el negocio y su columna actual
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

    if (!business || !sourceColumn || sourceColumn === newStage) return;

    // Actualizar estado optimistamente
    setColumns((prev) => {
      const newColumns = { ...prev };
      newColumns[sourceColumn!] = prev[sourceColumn!].filter((b) => b.id !== businessId);
      newColumns[newStage] = [{ ...business!, sales_stage: newStage }, ...prev[newStage]];
      return newColumns;
    });

    // Actualizar el negocio seleccionado
    setSelectedBusiness((prev) => prev ? { ...prev, sales_stage: newStage } : null);

    // Actualizar en DB
    updateBusinessStage(businessId, newStage);
  };

  const handleActionRegistered = () => {
    // Refrescar datos después de registrar una acción
    setTimeout(() => fetchKanbanData(), 500);
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
  const activeLeads = columns.nuevo.length + columns.contactado.length + columns.interesado.length + columns.cotizado.length;

  return (
    <div className="h-full">
      {/* Stats rápidos */}
      <div className="flex items-center gap-6 mb-4 text-sm">
        <span className="text-gray-600"><strong>{totalLeads}</strong> leads en total</span>
        <span className="text-blue-600"><strong>{activeLeads}</strong> en pipeline activo</span>
        <span className="text-green-600"><strong>{columns.cliente.length}</strong> clientes</span>
        <span className="text-amber-600"><strong>{columns.interesado.length + columns.cotizado.length}</strong> por cerrar</span>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMN_ORDER.map((columnId) => (
            <KanbanColumn
              key={columnId}
              columnId={columnId}
              businesses={columns[columnId]}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Modal de detalle */}
      {selectedBusiness && (
        <LeadDetailModal
          business={selectedBusiness}
          onClose={() => setSelectedBusiness(null)}
          onStageChange={handleStageChange}
          onActionRegistered={handleActionRegistered}
        />
      )}
    </div>
  );
}
