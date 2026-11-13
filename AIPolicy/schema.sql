DROP TABLE IF EXISTS custom_policy;
DROP TABLE IF EXISTS default_policy;

CREATE TABLE default_policy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grp VARCHAR(255) NOT NULL,
    tier int NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL
    prompt VARCHAR(255) NOT NULL
);

CREATE TABLE custom_policy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    class VARCHAR(50) NOT NULL,
    rules JSON NOT NULL,
    created BIGINT NOT NULL
);
