import React from 'react';
import Modal from '../Common/Modal';
import PartidaForm from './PartidaForm';

interface NuevaPartidaFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any, finalCategory: string) => Promise<void>;
    availableCategories: string[];
}

const NuevaPartidaForm: React.FC<NuevaPartidaFormProps> = ({
    isOpen,
    onClose,
    onSubmit,
    availableCategories
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nueva Partida">
            <PartidaForm
                onSubmit={onSubmit}
                onCancel={onClose}
                availableCategories={availableCategories}
                title="Nueva Partida"
                submitLabel="Crear partida"
            />
        </Modal>
    );
};

export default NuevaPartidaForm;
