import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const ImportSimple: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();

      reader.onload = (evt) => {
        try {
          const dataArray = evt.target?.result;
          const wb = XLSX.read(dataArray, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          if (!data || data.length === 0) {
            alert('El archivo parece estar vacío.');
            setIsUploading(false);
            return;
          }

          const items: { descripcion: string; cantidad: number }[] = [];
          let startRow = 1; // Default to start from second row if no header found
          let descCol = 0;  // Default description column
          let cantCol = 2;  // Default quantity column
          let hasNatColumn = false;

          // 1. Detectar Columnas (Busca encabezados de forma robusta e insensible a acentos)
          for (let i = 0; i < Math.min(20, data.length); i++) {
            const row = data[i];
            if (!row) continue;

            // Convertir todas las celdas a string simplificado para comparar
            const simplifiedRow = row.map((cell: any) =>
              String(cell || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
            );

            // Buscar patrón: Codigo, Nat, Ud, Resumen, CanPres...
            if (simplifiedRow.includes('codigo') && simplifiedRow.includes('nat')) {
              startRow = i + 1;
              descCol = simplifiedRow.indexOf('resumen');
              if (descCol === -1) descCol = simplifiedRow.indexOf('descripcion');

              cantCol = simplifiedRow.indexOf('canpres');
              if (cantCol === -1) cantCol = simplifiedRow.indexOf('medicion');

              // Valores recalibrados si fallan los índices directos
              if (descCol === -1) descCol = 3; // Default to 4th column (0-indexed)
              if (cantCol === -1) cantCol = 4; // Default to 5th column (0-indexed)

              hasNatColumn = true;
              break;
            }
          }

          // 2. Procesamiento de Filas con Filtrado Estricto
          for (let i = startRow; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const codigo = String(row[0] || '').trim();
            const nat = String(row[1] || '').trim();
            let descripcion = String(row[descCol] || '').trim();

            // FILTRO 1: Si hay columna NAT, solo aceptamos 'Partida'
            // Si no hay código y no es partida, ignoramos (esto mata los "Total I01" que no tienen código)
            if (hasNatColumn) {
              if (nat !== 'Partida') continue;
              if (!codigo) continue;
            } else {
              // En modo genérico, al menos necesitamos código y descripción
              if (!codigo || !descripcion) continue;
            }

            // FILTRO 2: Bloqueo explícito de palabras clave de resumen
            const lowerDesc = descripcion.toLowerCase();
            if (lowerDesc.startsWith('total') ||
              lowerDesc.includes('subtotal') ||
              lowerDesc.includes('resumen de')) {
              continue;
            }

            const cantRaw = row[cantCol];
            let cantidad = 0;

            // Parsear cantidad
            if (cantRaw !== null && cantRaw !== undefined && cantRaw !== '') {
              if (typeof cantRaw === 'number') {
                cantidad = cantRaw;
              } else {
                let cleaned = String(cantRaw).trim().replace(/\./g, '').replace(',', '.');
                cantidad = parseFloat(cleaned) || 0;
              }
            }

            // Buscar descripción extendida (evitando que capture la fila de "Total" de abajo)
            if (i + 1 < data.length) {
              const nextRow = data[i + 1];
              const nextCodigo = String(nextRow[0] || '').trim();
              const nextNat = String(nextRow[1] || '').trim();
              const nextDesc = String(nextRow[descCol] || '').trim();

              // Una extensión VÁLIDA no tiene código, ni naturaleza, y NO es un total
              if (!nextCodigo && !nextNat && nextDesc && !nextDesc.toLowerCase().startsWith('total')) {
                if (nextDesc.length > descripcion.length) {
                  descripcion = nextDesc;
                } else if (!descripcion.includes(nextDesc)) {
                  descripcion = `${descripcion} ${nextDesc}`;
                }
              }
            }

            if (descripcion && cantidad > 0) { // Solo añadir si hay descripción y cantidad > 0
              items.push({
                descripcion: descripcion,
                cantidad: cantidad
              });
            }
          }

          if (items.length === 0) {
            alert('No se detectaron partidas con medición. Comprueba el formato.');
            setIsUploading(false);
            return;
          }

          // Limpiar sesión previa para evitar que se mezclen partidas de archivos distintos
          localStorage.removeItem('comparador_items_actuales');
          localStorage.removeItem('comparador_global_percentage');
          localStorage.removeItem('comparador_file_name');
          localStorage.removeItem('comparador_id');
          sessionStorage.removeItem('comparativa_exportada');
          navigate('/importar-resumen', { state: { items, fileName: file.name } });
        } catch (error) {
          console.error('Error parsing excel:', error);
          alert('Error al detectar cantidades. Por favor, revisa el formato del archivo.');
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        alert('Error al leer el archivo.');
        setIsUploading(false);
      };

      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center h-full fade-in">
      <div className="w-full max-w-3xl flex flex-col gap-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Sube tu presupuesto</h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg">Formatos soportados: Excel (.xlsx, .xls) y Formato BC3.</p>
        </div>

        <div className="relative">
          <label className="group relative flex flex-col items-center justify-center w-full h-80 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-card-dark hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer overflow-hidden">
            {isUploading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="font-bold text-slate-700 dark:text-slate-200 text-xl">Procesando archivo...</p>
                <p className="text-sm text-slate-400">Analizando partidas con el motor de IA</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center pt-5 pb-6 gap-4 z-10">
                <div className="p-5 rounded-full bg-blue-50 dark:bg-primary/10 text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all shadow-lg shadow-primary/10">
                  <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-slate-700 dark:text-slate-200">Arrastra tu archivo aquí</p>
                  <p className="text-slate-400">o haz clic para explorar en tu equipo</p>
                </div>
              </div>
            )}
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} accept=".xlsx,.xls,.csv" />
          </label>
        </div>
      </div>
    </div>
  );
};

export default ImportSimple;
