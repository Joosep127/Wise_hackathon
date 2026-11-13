DROP TABLE IF EXISTS custom_policy;

CREATE TABLE custom_policy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    class VARCHAR(50) NOT NULL,
    rules JSON NOT NULL,
    created BIGINT NOT NULL
);
