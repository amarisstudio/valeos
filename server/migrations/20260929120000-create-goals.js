"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const teamId = {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "teams",
          key: "id",
        },
        onDelete: "CASCADE",
      };

      const userReference = (allowNull = false) => ({
        type: Sequelize.UUID,
        allowNull,
        references: {
          model: "users",
          key: "id",
        },
      });

      const timestamps = {
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      };

      await queryInterface.createTable(
        "goal_cycles",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
          },
          teamId,
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          startsAt: {
            type: Sequelize.DATEONLY,
            allowNull: false,
          },
          endsAt: {
            type: Sequelize.DATEONLY,
            allowNull: false,
          },
          createdById: userReference(),
          ...timestamps,
        },
        { transaction }
      );

      await queryInterface.addIndex("goal_cycles", ["teamId", "startsAt"], {
        transaction,
      });

      await queryInterface.createTable(
        "goal_objectives",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
          },
          teamId,
          cycleId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: "goal_cycles",
              key: "id",
            },
            onDelete: "CASCADE",
          },
          level: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          title: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          ownerId: userReference(),
          groupId: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: "groups",
              key: "id",
            },
            onDelete: "SET NULL",
          },
          parentId: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: "goal_objectives",
              key: "id",
            },
            onDelete: "SET NULL",
          },
          createdById: userReference(),
          ...timestamps,
        },
        { transaction }
      );

      await queryInterface.addIndex("goal_objectives", ["cycleId"], {
        transaction,
      });
      await queryInterface.addIndex("goal_objectives", ["parentId"], {
        transaction,
      });

      await queryInterface.createTable(
        "goal_key_results",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
          },
          teamId,
          objectiveId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: "goal_objectives",
              key: "id",
            },
            onDelete: "CASCADE",
          },
          title: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          type: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          startValue: {
            type: Sequelize.DOUBLE,
            allowNull: false,
            defaultValue: 0,
          },
          targetValue: {
            type: Sequelize.DOUBLE,
            allowNull: false,
          },
          currentValue: {
            type: Sequelize.DOUBLE,
            allowNull: false,
            defaultValue: 0,
          },
          unit: {
            type: Sequelize.STRING,
            allowNull: true,
          },
          ownerId: userReference(),
          status: {
            type: Sequelize.STRING,
            allowNull: true,
          },
          lastCheckInAt: {
            type: Sequelize.DATE,
            allowNull: true,
          },
          createdById: userReference(),
          ...timestamps,
        },
        { transaction }
      );

      await queryInterface.addIndex("goal_key_results", ["objectiveId"], {
        transaction,
      });
      await queryInterface.addIndex("goal_key_results", ["ownerId"], {
        transaction,
      });

      await queryInterface.createTable(
        "goal_check_ins",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
          },
          teamId,
          keyResultId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: "goal_key_results",
              key: "id",
            },
            onDelete: "CASCADE",
          },
          userId: userReference(),
          value: {
            type: Sequelize.DOUBLE,
            allowNull: false,
          },
          status: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          note: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          ...timestamps,
        },
        { transaction }
      );

      await queryInterface.addIndex(
        "goal_check_ins",
        ["keyResultId", "createdAt"],
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("goal_check_ins", { transaction });
      await queryInterface.dropTable("goal_key_results", { transaction });
      await queryInterface.dropTable("goal_objectives", { transaction });
      await queryInterface.dropTable("goal_cycles", { transaction });
    });
  },
};
