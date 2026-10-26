-- Cuenta bancaria definida exclusivamente por SUPERADMIN. Nunca inventar números.
CREATE TABLE cuentas_deposito (
 id INT NOT NULL PRIMARY KEY,
 banco NVARCHAR(12) NOT NULL DEFAULT N'BBVA',
 titular NVARCHAR(150) NOT NULL,
 numero_cuenta NVARCHAR(10) NOT NULL,
 clabe NVARCHAR(18) NULL,
 activo BIT NOT NULL DEFAULT 1,
 actualizado_en DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT ck_cuenta_banco CHECK (banco = N'BBVA')
);
GO
