-- Cuenta bancaria definida exclusivamente por SUPERADMIN. Nunca inventar números.
CREATE TABLE cuentas_deposito (
 id INT NOT NULL PRIMARY KEY,
 banco VARCHAR(12) NOT NULL DEFAULT 'BBVA',
 titular VARCHAR(150) NOT NULL,
 numero_cuenta VARCHAR(10) NOT NULL,
 clabe VARCHAR(18) NULL,
 activo TINYINT(1) NOT NULL DEFAULT 1,
 actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT ck_cuenta_banco CHECK (banco = 'BBVA')
);
