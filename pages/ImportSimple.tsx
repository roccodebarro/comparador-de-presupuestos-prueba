import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { parseBC3Simple } from '../utils/bc3Parser';

const ImportSimple: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);

      const ext = file.name.split('.').pop()?.toLowerCase();

      // ── BC3: usar parser específico ─────────────────────────────────
      if (ext === 'bc3') {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const buffer = evt.target?.result as ArrayBuffer;
            const items = parseBC3Simple(buffer);

            if (items.length === 0) {
              alert('No se detectaron partidas en el archivo BC3. Comprueba el formato.');
              setIsUploading(false);
              return;
            }

            localStorage.removeItem('comparador_items_actuales');
            localStorage.removeItem('comparador_global_percentage');
            localStorage.removeItem('comparador_file_name');
            localStorage.removeItem('comparador_id');
            sessionStorage.removeItem('comparativa_exportada');
            navigate('/importar-resumen', { state: { items, fileName: file.name } });
          } catch (error) {
            console.error('Error parsing BC3:', error);
            alert('Error al procesar el archivo BC3. Por favor, revisa el formato.');
            setIsUploading(false);
          }
        };
        reader.onerror = () => {
          alert('Error al leer el archivo.');
          setIsUploading(false);
        };
        reader.readAsArrayBuffer(file);
        return;
      }

      // ── XLSX / XLS: parser Excel ────────────────────────────────────
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

          const items: { descripcion: string; cantidad: number; codigo?: string }[] = [];
          let startRow = 1;
          let descCol = -1;
          let cantCol = -1;
          let hasNatColumn = false;
          let natCol = 1;

          // 1. Detectar Columnas (busca encabezados de forma robusta)
          for (let i = 0; i < Math.min(20, data.length); i++) {
            const row = data[i];
            if (!row) continue;

            const simplifiedRow = row.map((cell: any) =>
              String(cell || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
            );

            // Detectar si hay columna NAT (formato Arquímedes)
            const natIndex = simplifiedRow.findIndex((c: string) => c === 'nat' || c === 'naturaleza');
            if (natIndex !== -1) {
              hasNatColumn = true;
              natCol = natIndex;
            }

            // Buscar fila de encabezados con al menos 2 columnas reconocibles
            const hasDescHeader = simplifiedRow.some((c: string) =>
              ['resumen', 'descripcion', 'concepto', 'partida', 'detalle', 'texto', 'nombre'].includes(c)
            );
            const hasCantHeader = simplifiedRow.some((c: string) =>
              ['canpres', 'medicion', 'cantidad', 'cant', 'qty', 'uds', 'unidades', 'medic'].includes(c)
            );

            if (hasDescHeader || hasCantHeader || (simplifiedRow.includes('codigo') && simplifiedRow.length >= 3)) {
              startRow = i + 1;

              // Buscar columna de descripción
              for (const term of ['resumen', 'descripcion', 'concepto', 'partida', 'detalle', 'texto', 'nombre']) {
                const idx = simplifiedRow.indexOf(term);
                if (idx !== -1) { descCol = idx; break; }
              }

              // Buscar columna de cantidad/medición
              for (const term of ['canpres', 'medicion', 'cantidad', 'cant', 'qty', 'uds', 'unidades', 'medic']) {
                const idx = simplifiedRow.indexOf(term);
                if (idx !== -1) { cantCol = idx; break; }
              }

              break;
            }
          }

          // Fallbacks si no se encontraron columnas
          if (descCol === -1) {
            // Heurística: la columna más ancha (con más texto) suele ser la descripción
            // Buscar entre las primeras filas de datos
            let maxAvgLen = 0;
            for (let col = 0; col < (data[0]?.length || 5); col++) {
              let totalLen = 0;
              let count = 0;
              for (let row = startRow; row < Math.min(startRow + 10, data.length); row++) {
                const val = String(data[row]?.[col] || '');
                if (val) { totalLen += val.length; count++; }
              }
              const avgLen = count > 0 ? totalLen / count : 0;
              if (avgLen > maxAvgLen) {
                maxAvgLen = avgLen;
                descCol = col;
              }
            }
            if (descCol === -1) descCol = 3; // Último fallback
          }

          if (cantCol === -1) {
            // Heurística: buscar columna numérica que no sea precio unitario
            for (let col = 0; col < (data[0]?.length || 5); col++) {
              if (col === descCol) continue;
              let numCount = 0;
              for (let row = startRow; row < Math.min(startRow + 10, data.length); row++) {
                const val = data[row]?.[col];
                if (typeof val === 'number' || (typeof val === 'string' && /^[\d.,]+$/.test(val.trim()))) {
                  numCount++;
                }
              }
              if (numCount >= 3) { cantCol = col; break; }
            }
            if (cantCol === -1) cantCol = hasNatColumn ? 4 : 2;
          }

          // 2. Procesamiento de Filas
          for (let i = startRow; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const codigo = String(row[0] || '').trim();
            let descripcion = String(row[descCol] || '').trim();

            // Filtro modo Arquímedes: solo aceptar 'Partida'
            if (hasNatColumn) {
              const nat = String(row[natCol] || '').trim();
              if (nat !== 'Partida') continue;
              if (!codigo) continue;
            } else {
              // Modo genérico: necesitamos al menos descripción
              if (!descripcion) continue;
            }

            // Bloqueo de filas resumen
            const lowerDesc = descripcion.toLowerCase();
            if (lowerDesc.startsWith('total') ||
              lowerDesc.includes('subtotal') ||
              lowerDesc.includes('resumen de') ||
              lowerDesc.startsWith('capitulo') ||
              lowerDesc.startsWith('capítulo')) {
              continue;
            }

            const cantRaw = row[cantCol];
            let cantidad = 0;

            if (cantRaw !== null && cantRaw !== undefined && cantRaw !== '') {
              if (typeof cantRaw === 'number') {
                cantidad = cantRaw;
              } else {
                let cleaned = String(cantRaw).trim().replace(/\./g, '').replace(',', '.');
                cantidad = parseFloat(cleaned) || 0;
              }
            }

            // Buscar descripción extendida
            if (i + 1 < data.length) {
              const nextRow = data[i + 1];
              if (nextRow) {
                const nextCodigo = String(nextRow[0] || '').trim();
                const nextNat = hasNatColumn ? String(nextRow[natCol] || '').trim() : '';
                const nextDesc = String(nextRow[descCol] || '').trim();

                if (!nextCodigo && !nextNat && nextDesc && !nextDesc.toLowerCase().startsWith('total')) {
                  if (nextDesc.length > descripcion.length) {
                    descripcion = nextDesc;
                  } else if (!descripcion.includes(nextDesc)) {
                    descripcion = `${descripcion} ${nextDesc}`;
                  }
                }
              }
            }

            if (codigo || (descripcion && cantidad > 0)) {
              items.push({
                codigo: codigo,
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
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} accept=".xlsx,.xls,.csv,.bc3" />
          </label>
        </div>
      </div>
    </div>
  );
};

export default ImportSimple;
