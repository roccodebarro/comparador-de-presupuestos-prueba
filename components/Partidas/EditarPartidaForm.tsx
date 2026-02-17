import React from 'react';
import Modal from '../Common/Modal';
import PartidaForm from './PartidaForm';

interface EditarPartidaFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any, finalCategory: string) => Promise<void>;
    availableCategories: string[];
    initialData: {
        codigo: string;
        unidad: string;
        descripcion: string;
        precioUnitario: string;
        categoria: string;
    };
}

const EditarPartidaForm: React.FC<EditarPartidaFormProps> = ({
    isOpen,
    onClose,
    onSubmit,
    availableCategories,
    initialData
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Partida">
            <PartidaForm
                initialData={initialData}
                onSubmit={onSubmit}
                onCancel={onClose}
                availableCategories={availableCategories}
                title="Editar Partida"
                submitLabel="Guardar cambios"
            />
        </Modal>
    );
};

export default EditarPartidaForm;
