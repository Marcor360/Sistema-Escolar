import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from etl.etl import run


class ConexionesCliTests(unittest.TestCase):
    def test_fallo_conexion_destino_cierra_origen(self):
        origen = Mock()
        with patch('sys.argv', ['etl', '--entidad', 'planteles']), \
             patch.object(run, 'cargar_config', return_value=SimpleNamespace(target_engine='mysql')), \
             patch.object(run.extract, 'conectar_legacy', return_value=origen), \
             patch.object(run.load, 'conectar_destino', side_effect=RuntimeError('Destino no disponible')):
            with self.assertRaisesRegex(RuntimeError, 'Destino no disponible'):
                run.main()
        origen.close.assert_called_once_with()

    def test_fallo_pipeline_cierra_ambas_conexiones(self):
        origen, destino = Mock(), Mock()
        pipeline = Mock(side_effect=RuntimeError('Lote rechazado'))
        with patch('sys.argv', ['etl', '--entidad', 'planteles']), \
             patch.object(run, 'cargar_config', return_value=SimpleNamespace(target_engine='sqlserver')), \
             patch.object(run.extract, 'conectar_legacy', return_value=origen), \
             patch.object(run.load, 'conectar_destino', return_value=destino), \
             patch.dict(run.PIPELINES, {'planteles': pipeline}):
            with self.assertRaisesRegex(RuntimeError, 'Lote rechazado'):
                run.main()
        origen.close.assert_called_once_with()
        destino.close.assert_called_once_with()
